(() => {
 'use strict';

 // Ground coordinates follow the two diagonals of the isometric grid.
 // A rectangle is [uMin, vMin, uMax, vMax], and height is in screen pixels.
 window.AlleyStudyMap = {
  art: {
   backdrop: [
    {area:[-2,-2,2.5,10],height:34},
    {area:[-.5,-1,11,2.5],height:47},
    {area:[1.5,8,10,12],height:26},
    {area:[11,-1,14,8],height:42}
   ],
   ground: [
    {area:[1,3,12,6.5],material:'basalt'},
    {area:[4.5,6.5,8,9],material:'court'},
    {area:[9.5,1,12,3],material:'court'},
    {area:[1,3,8.55,3.48],material:'curb'},
    {area:[1,6.02,4.5,6.5],material:'curb'},
    {area:[9.22,6.02,12,6.5],material:'curb'},
    {area:[11.55,1,12,6.02],material:'curb'},
    {area:[8.55,3,9.22,6.5],material:'threshold'}
   ],
   groundDetails: {
    drain:[5.16,3.69],
    courtInlay:[6.2,8.03]
   },
   lighting: [
    {at:[3.85,3.04],height:38,radius:105,phase:.5},
    {at:[9.25,6.24],height:53,radius:110,phase:3}
   ],
   standing: [
    {area:[.9,1.25,3.32,3],height:99,roof:19,door:[2.6,3]},
    {area:[3.42,1.35,6.32,3],height:82,roof:24,door:[4,3]},
    {area:[6.42,1.05,8.42,3],height:110,roof:14,door:[7.45,3]},
    {area:[8.52,.95,9.5,3],height:88,roof:19,behindArch:true},
    {area:[1.4,6.5,3.9,8.1],height:57,roof:18},
    {area:[10.15,6.5,12.1,7.6],height:51,roof:15}
   ],
   atmosphere:[{at:[1.1,4.3],radius:130,phase:.6},{at:[11.6,1.6],radius:103,phase:2.2}],
   foreground: {
    arch:{area:[8.55,3,9.22,6.5],height:96,opening:[3.58,5.92],spring:56,peak:78}
   }
  },
  logic: {
   walkable:[[1,3,12,6.5],[4.5,6.5,8,9],[9.5,1,12,3]],
   spawn:[6.6,5.15],
   stations:{chest:{at:[10.58,4.95],front:1},'pickup-high':{at:[5.8,7.8],front:2}},
   barrel:[7,6.08],
   encounter:{archer:[10.9,1.65],entryV:3.55},
   waypoints:[[8.23,4.75],[9.48,4.75],[9.85,3.4],[7.45,6.27],[7.35,6.77]]
  }
 };
})();
