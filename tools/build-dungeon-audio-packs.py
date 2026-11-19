"""Package the supplied WAV archives as browser-ready audio. Requires ffmpeg."""
import argparse
import array
import io
import json
import math
import re
import subprocess
import wave
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "beta/assets/audio"
RATE = 44100
NAMES = {
    "Druckplatte_einsinken": "temple_plate_press",
    "Löwe_Kratztextur": "lion_claw_source",
    "Löwe_Ruf_nächstes_Tier": "lion_roar",
    "Löwe_Sprunglaut": "lion_leap",
    "Löwe_Warnknurren": "lion_growl",
    "Schlange_warnfauchen": "snake_hiss",
    "Schlange_zuschnappen_vorstoß": "snake_bite",
    "Stiefelschritt_Erde_TrockenesLaub": "step_earth",
    "Tempelfalle_Abschuss": "temple_trap_release",
    "Treffer_metallischeRüstungen_Klingen": "hit_metal",
    "Treffer_stumpf_weich": "hit_body",
    "Heldin_kurzerSchmerzlaut": "hero_pain_female",
    "Held_kurzerSchmerzlaut": "hero_pain",
    "held_körper_fällt": "hero_fall",
    "Hof_Friedhof_Regen": "amb_rain",
    "Lederriemen_Schnallen": "gear_leather",
    "Rüstung_Kette_Metall": "gear_mail",
    "Stiefelschritt_Holzbrücke_Dielen": "step_wood",
    "Stoff_in_Bewegung": "gear_cloth",
    "Treffer_Holz": "hit_wood",
    "Treffer_scharfer_Schnitt": "hit_cut",
    "Treffer_spröde_Knochen": "hit_bone",
    "Treffer_Stein": "hit_stone",
    "Trockene_Kerkerluft": "amb_dungeon",
}

PACK4_NAMES = {
    "armbrust_schuss": "crossbow_release",
    "Bogen_schuss": "bow_release",
    "Bogen_sehne_spannen": "bow_draw",
    "Feueratem_anhaltend": "element_fire_cone",
    "Fledermaus_Flügel": "bat_wings",
    "Fledermaus_Klicks_Schrei": "bat_voice",
    "Löwe_Pfote_Landung": "lion_paw",
    "schlange_schlängeln": "snake_slither",
    "Siegeltor_Steingeräusch": "gate_stone_motion",
    "Skelett_Bewegung_Knochenklappern": "enemy_skeleton_rattle",
    "spinne_netzabschuss": "enemy_spider_web",
    "spinne_netz_landet": "enemy_spider_web_land",
}


def ffmpeg(args, data):
    return subprocess.run(
        ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", *args],
        input=data, capture_output=True, check=True,
    ).stdout


def effect_samples(data, limit=None):
    raw = ffmpeg(["-i", "pipe:0", "-ac", "1", "-ar", str(RATE), "-f", "f32le", "pipe:1"], data)
    samples = array.array("f", raw)
    stride = RATE // 100
    peak = max(map(abs, samples))
    rms = [
        math.sqrt(sum(x * x for x in samples[i:i + stride]) / stride)
        for i in range(0, len(samples), stride)
    ]
    threshold = max(rms) * .035
    active = [index for index, value in enumerate(rms) if value > threshold]
    if not active or not peak:
        raise ValueError("Silent take")
    start = max(0, (active[0] - 2) * stride)
    end = min(len(samples), (active[-1] + 9) * stride)
    samples = samples[start:end]
    if limit and len(samples) > RATE * limit:
        tempo = len(samples) / (RATE * limit)
        samples = array.array("f", ffmpeg(
            ["-f", "f32le", "-ar", str(RATE), "-ac", "1", "-i", "pipe:0",
             "-af", f"atempo={tempo:.9f}", "-t", str(limit), "-f", "f32le", "pipe:1"],
            samples.tobytes(),
        ))
        peak = max(map(abs, samples))
    gain = .37 / peak
    fade_in = RATE // 1500
    fade_out = min(len(samples) // 5, RATE // 50)
    return array.array("h", (
        round(x * gain * 32767 * min(1, i / fade_in, (len(samples) - 1 - i) / fade_out))
        for i, x in enumerate(samples)
    ))


def supplied_takes(volumes, names):
    takes = {}
    for volume in volumes:
        with zipfile.ZipFile(ASSETS / f"sound_effects_{volume}.zip") as source:
            for entry in source.infolist():
                if not entry.filename.endswith(".wav"):
                    continue
                name, _, variant = re.fullmatch(
                    r"(.+?)( \((\d+)\))?", Path(entry.filename).stem
                ).groups()
                takes.setdefault(names[name], []).append((int(variant or 1), source.read(entry)))

    return takes


def build_bank(takes, loops, asset_name, bank_name, global_name):
    bank = {}
    timeline = array.array("h")
    for cue, recordings in sorted(takes.items()):
        if cue in loops:
            [(_, data)] = recordings
            (ASSETS / f"{cue}.mp3").write_bytes(ffmpeg(
                ["-i", "pipe:0", "-ac", "2", "-ar", str(RATE), "-c:a", "libmp3lame",
                 "-b:a", "96k", "-f", "mp3", "pipe:1"], data,
            ))
            continue
        bank[cue] = []
        for _, data in sorted(recordings):
            clip = effect_samples(data, .71 if cue == "element_fire_cone" else None)
            bank[cue].append([round(len(timeline) / RATE, 6), round(len(clip) / RATE, 6)])
            timeline.extend(clip)
            timeline.extend([0] * (RATE // 12))

    wav = io.BytesIO()
    with wave.open(wav, "wb") as stream:
        stream.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        stream.writeframes(timeline.tobytes())
    # A seekable output is needed for the MP3 encoder's delay and length metadata.
    asset = ASSETS / f"{asset_name}.mp3"
    subprocess.run(
        ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
         "-i", "pipe:0", "-c:a", "libmp3lame", "-b:a", "96k", str(asset)],
        input=wav.getvalue(), check=True,
    )
    (ROOT / "beta" / bank_name).write_text(
        "// Generated by tools/build-dungeon-audio-packs.py.\n"
        f"window.{global_name} = " + json.dumps(bank, indent=1) + ";\n", encoding="utf-8",
    )
    print(f"{sum(map(len, bank.values()))} one-shots, {len(takes)-len(bank)} ambience loops")



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--elevenlabs", type=Path, help="Directory containing ElevenLabs MP3s named by cue ID")
    source.add_argument("--pack4", action="store_true", help="Build the combat sounds from sound_effects_4.zip")
    args = parser.parse_args()
    if args.pack4:
        build_bank(supplied_takes((4,), PACK4_NAMES), set(), "soundpack-4-sfx",
                   "dungeon-soundpack4-bank.js", "DungeonSoundpack4Bank")
        return
    if args.elevenlabs is None:
        build_bank(supplied_takes((2, 3), NAMES), {"amb_dungeon", "amb_rain"}, "pack-sfx",
                   "dungeon-package-bank.js", "DungeonPackageBank")
        return

    queue = json.loads((ROOT / "tools/audio-generation-queue.json").read_text(encoding="utf-8"))
    sources = {path.stem: path for path in args.elevenlabs.glob("*.mp3")}
    takes = {cue["cue"]: [(1, sources[cue["cue"]].read_bytes())]
             for cue in queue["cues"] if cue["cue"] in sources}
    if not takes:
        parser.error("No ElevenLabs files match the audio queue")
    loops = {cue["cue"] for cue in queue["cues"] if cue["loop"]}
    build_bank(takes, loops, "elevenlabs-sfx", "dungeon-elevenlabs-bank.js", "DungeonElevenLabsBank")


if __name__ == "__main__":
    main()
