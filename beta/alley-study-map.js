(() => {
 'use strict';

 // Ground coordinates follow the two diagonals of the isometric grid.
 // A rectangle is [uMin, vMin, uMax, vMax], and height is in screen pixels.
 window.AlleyStudyMap = {
  art: {
   backdrop: [
    {area:[-2,-2,2.5,10],height:44},
    {area:[-.5,-1,11,2.5],height:60},
    {area:[1.5,8.9,10,12],height:39},
    {area:[11,-1,14,8.6],height:55}
   ],
   ground: [
    {area:[1,2.75,12,6.85],material:'basalt'},
    {area:[4.5,6.8,8.1,9.4],material:'court'},
    {area:[9.5,.8,12,2.75],material:'court'},
    {area:[1,2.75,8.55,3.12],material:'curb'},
    {area:[1,6.48,4.5,6.85],material:'curb'},
    {area:[9.22,6.48,12,6.85],material:'curb'},
    {area:[11.55,.8,12,6.48],material:'curb'},
    {area:[8.55,2.75,9.22,6.85],material:'threshold'}
   ],
   groundDetails: {
    drain:[5.16,3.51],
    courtInlay:[6.2,8.21]
   },
   lighting: [
    {at:[3.85,3],height:48,radius:112,phase:.5},
    {at:[9.25,6.24],height:64,radius:122,phase:3}
   ],
   standing: [
    {area:[.72,.75,3.32,2.75],height:133,roof:26,door:[2.6,2.75],style:'plaster',lantern:{at:[1.36,2.75],height:37,warm:true}},
    {area:[3.42,.78,6.32,2.75],height:118,roof:28,door:[4,2.75],style:'timber',lantern:{at:[5.8,2.75],height:40,warm:true}},
    {area:[6.42,.44,8.42,2.75],height:144,roof:20,door:[7.45,2.75],style:'stone'},
    {area:[8.52,.42,9.5,2.75],height:120,roof:25,behindArch:true,style:'teal'},
    {area:[1.18,6.85,3.95,9.12],height:91,roof:25,style:'stone'},
    {area:[10.05,6.85,12.3,8.6],height:88,roof:22,style:'plaster'}
   ],
   atmosphere:[{at:[1.1,4.3],radius:130,phase:.6},{at:[11.6,1.6],radius:103,phase:2.2}],
   foreground: {
    arch:{area:[8.55,2.75,9.22,6.85],height:124,opening:[3.42,6.16],spring:70,peak:99,
     lantern:{at:[9.22,6.27],height:30,warm:true}}
   }
  },
  logic: {
   walkable:[[1,2.75,12,6.85],[4.5,6.8,8.1,9.4],[9.5,.8,12,2.75]],
   spawn:[6.6,5.15],
   stations:{chest:{at:[10.58,4.95],front:1},'pickup-high':{at:[5.8,7.8],front:2}},
   barrel:[7,6.08],
   encounter:{archer:[10.9,1.65],entryV:3.42},
   waypoints:[[8.23,4.75],[9.48,4.75],[9.85,3.28],[7.45,6.32],[7.35,6.93]]
  }
 };
})();
