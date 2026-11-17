#!/usr/bin/env python3
"""Render original Mind Dungeon one-shots. Requires numpy, scipy and ffmpeg."""
import json
import math
from pathlib import Path
import subprocess
import tempfile
import wave
import zlib

import numpy as np
from scipy import signal

RATE = 44100
PAD = 0.075
ROOT = Path(__file__).resolve().parents[1] / "beta"
ENTRIES = []


class Cue:
    def __init__(self, key, length, variant):
        self.audio = np.zeros(round(RATE * length))
        seed = zlib.crc32(key.encode()) + variant
        self.rng = np.random.default_rng(seed)
        self.tune = self.rng.uniform(.966, 1.035)

    def times(self, duration):
        return np.arange(round(duration * RATE)) / RATE

    def layer(self, start, samples, gain):
        offset = round(start * RATE)
        length = min(len(samples), len(self.audio) - offset)
        if length > 0:
            self.audio[offset:offset + length] += gain * samples[:length]

    def air(self, start, length, low, high, gain, attack=.015, tail=.12, flutter=0):
        t = self.times(length)
        band = signal.butter(2, [low, high], fs=RATE, btype="bandpass", output="sos")
        air = signal.sosfilt(band, self.rng.normal(size=len(t)))
        air /= max(.0001, np.std(air))
        shape = -np.expm1(-t / attack) * np.exp(-t / tail)
        if flutter:
            shape *= .74 + .26 * np.sin(2 * np.pi * (flutter * t + 3 * t * t)) ** 2
        self.layer(start, air * shape, gain)

    def gust(self, start, length, low, high, gain, peak=.56):
        t = self.times(length)
        x = t / length
        hiss = self.rng.normal(size=len(t))
        result = np.zeros_like(t)
        for i, factor in enumerate((.58, 1, 1.68)):
            band = signal.butter(2, [low * factor, high * factor], fs=RATE, btype="bandpass", output="sos")
            texture = signal.sosfilt(band, hiss)
            texture /= max(.0001, np.std(texture))
            shape = np.exp(-((x - peak - (i - 1) * .13) / (.25 - i * .03)) ** 2)
            result += texture * shape * (1 - i * .17)
        self.layer(start, result * np.sin(np.pi * x) ** 1.8, gain / 2)

    def modes(self, start, length, root, ratios, gain, decay, attack=.003, glide=0):
        t = self.times(length)
        stack = np.zeros_like(t)
        for index, ratio in enumerate(ratios):
            freq = root * ratio * self.tune
            phase = 2 * np.pi * freq * (t + glide * decay * -np.expm1(-t / decay))
            partial = np.sin(phase + self.rng.uniform(-.4, .4))
            partial *= np.exp(-t / (decay / (1 + index * .39))) / (1 + index * .8)
            stack += partial
        self.layer(start, stack * -np.expm1(-t / attack), gain)

    def tremor(self, start, length, root, gain, rise=False):
        t = self.times(length)
        x = t / length
        glide = root * (.75 * t + (1 if rise else -.38) * t * x / 2)
        carrier = 2 * np.pi * glide * self.tune
        modulation = (.64 + .36 * np.sin(2 * np.pi * (10 * t + 7 * t * x)))
        timbre = np.sin(carrier + .32 * np.sin(carrier * 2.13)) + .27 * np.sin(carrier * 1.506)
        self.layer(start, np.tanh(timbre * modulation) * np.sin(np.pi * x) ** 1.4, gain)

    def body(self, root, gain, tail=.05):
        self.modes(0, min(len(self.audio) / RATE, .42), root, (1, 1.59, 2.38), gain, tail, .002, .49)
        self.air(0, .14, 115, 580, gain * .23, .0015, .033)

    def render(self, peak):
        # Filter subsonic/DC energy, then taper both edges before packing.
        hp = signal.butter(2, 42, fs=RATE, btype="highpass", output="sos")
        x = signal.sosfilt(hp, self.audio)
        end = min(round(.032 * RATE), len(x) // 4)
        head = round(.002 * RATE)
        x[:head] *= np.linspace(0, 1, head)
        x[-end:] *= np.linspace(1, 0, end) ** 2
        ceiling = 10 ** (peak / 20)
        return np.rint(x * ceiling / max(.0001, np.max(np.abs(x))) * 32767).astype("<i2")


def cue(key, duration, variations=1, peak=-10):
    def define(recipe):
        ENTRIES.append((key, duration, variations, peak, recipe))
        return recipe
    return define


def ui(c, root, bright=0.0):
    c.air(0, .048, 660, 1920, .11 + bright * .055, .001, .012)
    c.modes(.003, .13, root, (1, 1.47, 2.09, 2.94), .43, .024 + .015 * bright)
    c.modes(.006, .07, 175, (1, 1.74), .14, .022)


@cue("ui_click", .105, 3, -17)
def click(c):
    ui(c, 350)


@cue("ui_select", .12, 3, -18)
def select(c):
    ui(c, 455, .24)


@cue("ui_confirm", .25, peak=-15)
def confirm(c):
    ui(c, 310)
    c.modes(.049, .20, 467, (1, 1.51, 2.33), .31, .046)


@cue("ui_back", .175, peak=-17)
def back(c):
    ui(c, 280)
    c.modes(.024, .14, 193, (1, 1.54, 2.04), .27, .028)


@cue("ui_error", .25, peak=-15)
def error(c):
    c.body(105, .42, .056)
    c.modes(.031, .18, 161, (1, 1.063, 2.29), .23, .044, .007, .034)
    c.air(.004, .14, 250, 1220, .10, .008, .044)


@cue("ui_open", .27, 2, -18)
def open_ui(c):
    c.gust(0, .25, 180, 1780, .20, .48)
    c.modes(.107, .14, 272, (1, 1.56, 2.22), .18, .029)


@cue("ui_close", .22, 2, -18)
def close_ui(c):
    c.gust(0, .19, 170, 1400, .14, .38)
    c.modes(.095, .12, 201, (1, 1.44, 2.18), .17, .029)


def swing(c, length, low, high, weight, peak=.58):
    c.gust(0, length, low, high, .4, peak)
    c.gust(length * .19, length * .77, low * .62, high * .58, weight, peak)
    c.modes(length * .36, length * .57, low * .41, (1, 1.57, 2.24), weight * .22, .048, .014, .28)


@cue("weapon_swing_light", .29, 4, -11)
def light_swing(c):
    swing(c, .26, 360, 2550, .18)
    c.gust(.071, .145, 2200, 5700, .078)


@cue("weapon_thrust", .20, 3, -12)
def thrust(c):
    swing(c, .168, 540, 2900, .11, .67)
    c.gust(.050, .105, 1200, 4800, .095, .65)


@cue("weapon_dagger", .17, 3, -13)
def dagger(c):
    swing(c, .146, 650, 3900, .11, .55)


@cue("weapon_hammer", .39, 3, -9)
def hammer(c):
    swing(c, .355, 130, 1280, .47, .70)
    c.gust(.084, .27, 190, 880, .22, .72)


@cue("weapon_staff", .34, 3, -11)
def staff(c):
    swing(c, .29, 215, 1920, .24)
    c.tremor(.034, .25, 243, .09, True)


@cue("weapon_blade", .32, 3, -11)
def blade(c):
    swing(c, .281, 310, 2770, .19)
    c.air(.13, .17, 840, 4370, .065, .01, .06, 19)


@cue("weapon_greatsword", .47, 3, -9)
def greatsword(c):
    swing(c, .421, 180, 2280, .39, .65)
    c.gust(.059, .322, 700, 3410, .19, .66)


@cue("hero_dash", .31, 4, -12)
def dash(c):
    swing(c, .27, 180, 2080, .22, .42)
    c.gust(.032, .21, 800, 2600, .07, .50)


@cue("hero_exhausted", .27, peak=-14)
def exhausted(c):
    c.body(77, .31, .07)
    c.air(.018, .21, 275, 980, .085, .035, .08)


@cue("weapon_charge_start", .37, peak=-14)
def charge_start(c):
    c.tremor(0, .32, 115, .30, True)
    c.gust(0, .35, 300, 1450, .14, .71)


@cue("weapon_charge_ready", .31, peak=-12)
def charge_ready(c):
    c.modes(.002, .28, 246, (1, 1.44, 2.08, 3.08), .38, .082, .005)
    c.air(0, .20, 470, 2040, .09, .005, .042)


@cue("weapon_charge_release", .40, 2, -11)
def charge_release(c):
    c.gust(0, .35, 100, 1420, .25)
    c.modes(.089, .28, 94, (1, 1.64, 2.9), .26, .073, .008, .48)


@cue("bolt_fly", .235, 4, -12)
def bolt(c):
    c.gust(0, .205, 770, 4390, .29, .59)
    c.tremor(.035, .135, 1100, .026)


@cue("hit_crit", .31, 3, -9)
def crit(c):
    c.body(101, .42, .060)
    c.modes(.006, .274, 565, (1, 1.42, 2.08, 3.01), .23, .075, .002, .12)
    c.air(0, .135, 1180, 4530, .14, .001, .025)


@cue("hit_counter", .35, 2, -8)
def counter(c):
    c.air(0, .18, 750, 3600, .20, .001, .041)
    c.modes(0, .30, 364, (1, 1.64, 2.41, 3.25), .42, .092)
    c.modes(.081, .24, 184, (1, 1.46, 2.67), .18, .068, .006)


@cue("hit_fatal", .57, 2, -7)
def fatal(c):
    c.body(68, .52, .119)
    c.modes(.014, .48, 239, (1, 1.53, 2.71), .27, .135, .004, .31)
    c.air(0, .22, 600, 3500, .14, .002, .041)
    c.air(.082, .39, 168, 790, .12, .030, .12)


@cue("hit_immune", .18, 2, -16)
def immune(c):
    c.modes(0, .16, 610, (1, 1.83, 2.32), .44, .027)
    c.air(0, .058, 990, 4120, .04, .001, .012)

@cue("element_fire_cast", .62, 2, -12)
def fire_cast(c):
    c.gust(0, .55, 260, 2060, .23, .65)
    c.air(.095, .46, 750, 4290, .12, .08, .22, 17)
    c.tremor(.045, .44, 105, .18, True)


@cue("element_fire_impact", .35, 3, -10)
def fire_impact(c):
    c.body(104, .36, .065)
    c.air(0, .29, 450, 5600, .16, .001, .079, 23)
    for at in sorted(c.rng.uniform(.019, .13, size=5)):
        c.air(at, .07, 1560, 7100, .09, .002, .016)


@cue("element_frost_cast", .73, 2, -12)
def frost_cast(c):
    c.gust(0, .63, 980, 3830, .15, .62)
    c.tremor(.01, .65, 286, .18, True)
    for at, tone in ((.18, 591), (.28, 884), (.40, 1210)):
        c.modes(at, .25, tone, (1, 1.89, 2.28), .12, .055, .013, .045)


@cue("element_frost_impact", .51, 3, -10)
def frost_impact(c):
    c.air(0, .29, 1120, 8100, .23, .001, .066)
    c.body(121, .28, .064)
    for at in sorted(c.rng.uniform(.01, .23, size=9)):
        c.modes(at, .12, c.rng.uniform(1050, 2780), (1, 1.74, 2.21), .085, .023)


@cue("element_magic_charge", .61, 2, -13)
def magic_charge(c):
    c.tremor(0, .55, 157, .35, True)
    c.gust(0, .56, 290, 2250, .12, .60)
    c.modes(.18, .38, 394, (1, 1.47, 2.62, 3.19), .13, .14, .075)


@cue("element_magic_hit", .45, 3, -10)
def magic_hit(c):
    c.body(127, .35)
    c.tremor(.002, .37, 294, .25)
    c.modes(.017, .38, 416, (1, 1.65, 2.3), .15, .126, .006)


@cue("element_dark_rift", .83, 2, -11)
def dark_rift(c):
    c.tremor(0, .76, 86, .37)
    c.gust(.028, .69, 100, 1330, .25, .57)
    c.air(.14, .63, 120, 610, .12, .11, .36, 22)


@cue("element_dark_hit", .39, 3, -12)
def dark_hit(c):
    c.body(85, .44)
    c.tremor(.006, .36, 115, .20)
    c.air(.003, .23, 230, 1370, .15, .003, .066, 14)


@cue("element_lightning_charge", .92, 2, -13)
def lightning_charge(c):
    c.tremor(0, .84, 179, .25, True)
    for at in sorted(c.rng.uniform(.08, .68, size=9)):
        c.air(at, .105, 1280, 5120, .1 + .16 * at, .002, .021, 43)


@cue("element_lightning_beam", .96, 2, -10)
def lightning_beam(c):
    c.air(0, .87, 780, 4520, .16, .006, .50, 54)
    c.tremor(.011, .89, 116, .20)
    for at in (.003, .109, .221, .381, .53, .67, .81):
        c.air(at, .107, 1110, 6440, .25 * math.exp(-1.1 * at), .001, .033, 47)


@cue("element_lightning_impact", .49, 3, -8)
def lightning_hit(c):
    c.body(81, .35, .091)
    c.air(0, .42, 1100, 6200, .30, .001, .065, 43)
    c.air(.039, .31, 330, 2400, .23, .007, .11, 38)
    c.modes(.012, .41, 144, (1, 1.79, 2.34, 3.25), .19, .09, .003, .48)


@cue("element_poison_apply", .48, 3, -13)
def poison(c):
    c.tremor(.012, .42, 153, .25)
    c.air(0, .44, 580, 3380, .14, .018, .17, 23)
    for at in (.018, .069, .153, .241):
        c.modes(at, .15, c.rng.uniform(270, 480), (1, 1.61, 2.37), .18, .035, .003, 1.1)


@cue("element_poison_tick", .19, 3, -20)
def poison_tick(c):
    c.modes(.004, .14, 218, (1, 1.34, 2.06), .24, .033, .006, 1.38)
    c.air(0, .14, 320, 1700, .085, .003, .035)


@cue("element_bleed_hero", .58, 2, -9)
def bloodloss(c):
    c.body(75, .54, .11)
    c.air(.002, .27, 360, 2630, .15, .004, .06, 20)
    c.tremor(.085, .45, 105, .22)


@cue("element_bleed_enemy", .31, 3, -14)
def bleeding(c):
    c.body(109, .30, .052)
    c.air(.002, .23, 340, 1710, .16, .003, .06, 19)


def ritual(c, notes, root, length, ending=False):
    c.gust(0, length * .83, 190, 1450, .12, .38 if ending else .65)
    c.tremor(.007, length * .88, root, .12, not ending)
    for i, (start, ratio, gain) in enumerate(notes):
        c.modes(start, length - start, root * ratio, (1, 1.512, 2.034, 2.78, 4.22),
                gain, .08 + length * .13 - i * .012, .006 + i * .005)


@cue("element_heal", .65, 2, -14)
def healing(c):
    ritual(c, ((.016, 1, .27), (.12, 1.5, .21), (.23, 2, .14)), 247, .64)


@cue("element_buff_on", .51, 2, -14)
def buff_on(c):
    ritual(c, ((.012, 1, .22), (.10, 1.345, .24)), 227, .50)


@cue("element_buff_off", .43, 2, -17)
def buff_off(c):
    ritual(c, ((.009, 1.36, .22), (.089, 1, .23)), 218, .42, True)


@cue("shrine_open", .65, 2, -13)
def shrine_open(c):
    ritual(c, ((.038, 1, .21), (.20, 1.42, .17), (.28, 2.09, .10)), 160, .64)


@cue("shrine_spent", .65, peak=-14)
def shrine_spent(c):
    ritual(c, ((.012, 1.52, .18), (.13, 1, .18)), 141, .64, True)
    c.air(.16, .38, 170, 870, .09, .035, .093)


@cue("gate_seal_progress", .35, 2, -15)
def gate_progress(c):
    c.modes(.02, .30, 193, (1, 1.67, 2.82), .28, .085, .009)
    c.gust(0, .30, 171, 1280, .12, .49)


@cue("gate_open_final", .84, peak=-12)
def gate_open(c):
    ritual(c, ((.01, 1, .32), (.18, 1.514, .29), (.35, 1.965, .11)), 131, .83)
    c.tremor(.034, .72, 77, .13)


@cue("temple_shrine_progress", .40, peak=-14)
def temple_progress(c):
    ritual(c, ((.023, 1.01, .23), (.126, 1.64, .16)), 209, .39)


@cue("temple_shrine_success", .86, peak=-11)
def temple_success(c):
    ritual(c, ((.01, 1, .28), (.16, 1.49, .20), (.31, 2.12, .16)), 216, .84)
    c.modes(.007, .55, 1145, (1, 1.37, 2.12), .16, .092)


@cue("temple_shrine_fail", .59, peak=-13)
def temple_fail(c):
    ritual(c, ((.022, 1.45, .21), (.125, 1.065, .18), (.24, 1, .06)), 140, .57, True)


@cue("world_well_offer", .82, peak=-15)
def well_offer(c):
    ritual(c, ((.049, 1, .22), (.22, 1.585, .19)), 155, .81)
    c.tremor(.036, .56, 107, .089, True)


@cue("world_well_reward", .70, peak=-13)
def well_reward(c):
    ritual(c, ((.024, 1.1, .19), (.143, 1.62, .17), (.249, 2.15, .15)), 205, .68)


@cue("loot_soul_spawn", .37, 3, -16)
def soul_spawn(c):
    c.gust(0, .31, 300, 1830, .14, .58)
    c.modes(.052, .31, 334, (1, 1.71, 2.21), .32, .069, .015)


@cue("loot_soul_pick", .34, 2, -14)
def soul_pick(c):
    ui(c, 336, .12)
    c.modes(.043, .27, 516, (1, 1.42, 2.08), .24, .064, .009)


@cue("loot_rare", .49, peak=-13)
def rare(c):
    ritual(c, ((.004, 1, .29), (.10, 1.49, .23)), 298, .48)


@cue("loot_epic", .64, peak=-12)
def epic(c):
    ritual(c, ((.01, 1, .31), (.11, 1.345, .23), (.20, 1.83, .16)), 263, .62)


@cue("loot_exalted", .82, peak=-11)
def exalted(c):
    ritual(c, ((.013, 1, .27), (.13, 1.415, .24), (.27, 1.947, .18)), 219, .80)
    c.modes(.007, .66, 127, (1, 1.49, 1.96, 3.53), .12, .19, .014)

@cue("learn_card", .24, 3, -17)
def card(c):
    c.gust(0, .198, 466, 4610, .15, .43)
    c.air(.108, .105, 790, 3270, .14, .004, .037)
    c.modes(.13, .10, 321, (1, 1.66), .09, .032)


@cue("learn_right", .46, peak=-13)
def right(c):
    ritual(c, ((.006, 1, .26), (.102, 1.50, .22)), 333, .45)


@cue("learn_wrong", .41, peak=-14)
def wrong(c):
    c.body(108, .23, .060)
    ritual(c, ((.018, 1.415, .20), (.116, 1, .20)), 171, .40, True)


@cue("learn_level_up", 1.12, peak=-10)
def level(c):
    ritual(c, ((.009, 1, .29), (.166, 1.49, .23), (.316, 2.02, .20), (.465, 2.99, .11)), 173, 1.11)
    c.modes(.076, 1.02, 88, (1, 1.51, 2.05), .22, .27, .06)


@cue("learn_stat", .38, peak=-15)
def stat(c):
    ui(c, 255, .10)
    c.modes(.041, .32, 421, (1, 1.49, 2.81), .20, .076, .006)


@cue("trial_open", .43, peak=-15)
def trial_open(c):
    c.tremor(.008, .38, 148, .22, True)
    c.modes(.039, .36, 295, (1, 1.63, 2.56), .23, .09, .008)


@cue("trial_start", .48, peak=-14)
def trial_start(c):
    c.modes(0, .24, 237, (1, 1.67, 2.23), .26, .06)
    c.modes(.113, .34, 318, (1, 1.53, 2.18), .26, .087)


@cue("trial_warning", .24, peak=-15)
def trial_warning(c):
    c.modes(.002, .20, 254, (1, 1.07, 2.41), .24, .046)
    c.modes(.06, .16, 363, (1, 1.66), .13, .04)


@cue("trial_win", .85, peak=-11)
def trial_win(c):
    ritual(c, ((.006, 1, .28), (.134, 1.26, .23), (.29, 1.5, .24)), 256, .84)


@cue("trial_fail", .69, peak=-11)
def trial_fail(c):
    c.body(71, .47, .105)
    ritual(c, ((.008, 1.41, .18), (.141, 1, .22)), 145, .68, True)


@cue("trial_ambush", .88, peak=-10)
def trial_ambush(c):
    c.tremor(.004, .81, 88, .39)
    c.gust(.054, .71, 150, 1520, .25, .30)
    c.modes(.153, .65, 123, (1, 1.58, 2.32), .21, .124, .037)


@cue("boss_enter", .79, peak=-13)
def boss_enter(c):
    c.tremor(0, .76, 73, .28, True)
    c.modes(.087, .68, 147, (1, 1.391, 2.07), .24, .174, .054)


@cue("boss_defeat", .69, peak=-13)
def boss_defeat(c):
    c.tremor(.009, .62, 97, .27)
    c.modes(.036, .64, 138, (1, 1.64, 2.45), .29, .17, .026, .11)


@cue("floor_portal_spawn", 1.05, peak=-12)
def portal_spawn(c):
    c.tremor(.025, .96, 93, .34, True)
    ritual(c, ((.019, 1, .20), (.20, 1.505, .18), (.41, 2.04, .17)), 182, 1.02)


@cue("floor_portal_enter", .43, peak=-14)
def portal_enter(c):
    c.gust(0, .396, 110, 1600, .27, .43)
    c.tremor(.028, .34, 144, .27)
    c.modes(.077, .335, 217, (1, 1.45, 2.06), .20, .069, .01)


@cue("floor_victory", 1.4, peak=-10)
def victory(c):
    ritual(c, ((.013, 1, .28), (.15, 1.50, .22), (.32, 1.97, .18), (.49, 2.99, .14)), 146, 1.39)
    c.modes(.079, 1.23, 73, (1, 1.498, 2.025), .27, .32, .052)


@cue("hero_death", .50, peak=-11)
def death(c):
    c.body(64, .41, .093)
    c.tremor(.006, .46, 99, .25)
    c.air(0, .46, 143, 870, .14, .018, .116)


def main():
    destination = ROOT / "assets/audio"
    destination.mkdir(parents=True, exist_ok=True)
    clips = {}
    frames = [np.zeros(round(PAD * RATE), dtype="<i2")]
    offset = len(frames[0])
    for key, duration, variants, peak, recipe in ENTRIES:
        clips[key] = []
        for variant in range(variants):
            sound = Cue(key, duration, variant)
            recipe(sound)
            samples = sound.render(peak)
            clips[key].append([round(offset / RATE, 6), round(len(samples) / RATE, 6)])
            frames.extend((samples, frames[0]))
            offset += len(samples) + len(frames[0])
    with tempfile.TemporaryDirectory() as temp:
        master = Path(temp) / "sfx.wav"
        with wave.open(str(master), "wb") as wav:
            wav.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
            wav.writeframes(np.concatenate(frames).tobytes())
        # LAME includes gapless trim metadata. The padding also protects sprite boundaries.
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(master),
                        "-codec:a", "libmp3lame", "-b:a", "64k", "-map_metadata", "-1",
                        str(destination / "shadowbound-sfx.mp3")], check=True)
    catalog = "\n".join(f"  {key}: {json.dumps(value)}," for key, value in clips.items())
    (ROOT / "dungeon-sfx-bank.js").write_text(
        "// Generated by tools/build-dungeon-sfx.py. Offsets and durations are in seconds.\n"
        f"window.DungeonSfxBank = {{\n{catalog}\n}};\n"
    )
    print(f"{len(clips)} cues · {sum(map(len, clips.values()))} takes · {offset / RATE:.2f} s")


if __name__ == "__main__":
    main()
