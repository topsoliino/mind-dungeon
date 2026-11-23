import { Matrix4, Vector3 } from './vendor/guardian-three/three.js';

// Orthographic software rasterizer for the Guardian's untextured, rigidly
// articulated Blender meshes. The same mixer, camera and part visibility
// feed both renderers. A per-pixel depth buffer preserves overlapping armor.
export function createCanvasRenderer(size) {
 const domElement = document.createElement('canvas');
 domElement.width = domElement.height = size;
 const ctx = domElement.getContext('2d');
 const pixels = ctx.createImageData(size, size);
 const depth = new Float32Array(size * size);
 const transform = new Matrix4(), view = new Matrix4(), vertex = new Vector3();
 const cache = new WeakMap();
 function project(mesh) {
  const geometry = mesh.geometry;
  const positions = geometry.attributes.position;
  let projected = cache.get(mesh);
  if (!projected) {
   projected = new Float32Array(positions.count * 3);
   cache.set(mesh, projected);
  }
  transform.multiplyMatrices(view, mesh.matrixWorld);
  for (let i = 0; i < positions.count; i++) {
   mesh.getVertexPosition(i, vertex).applyMatrix4(transform);
   projected[i*3] = (1 + vertex.x) * size / 2;
   projected[i*3+1] = (1 - vertex.y) * size / 2;
   projected[i*3+2] = vertex.z;
  }
  return projected;
 }
 function channel(linear) {
  const v = Math.max(0, linear);
  const mapped = Math.min(1, v*(2.51*v+.03)/(v*(2.43*v+.59)+.14));
  return Math.round(255*(mapped<=.0031308?12.92*mapped:1.055*mapped**(1/2.4)-.055));
 }
 function drawMesh(mesh) {
  const p = project(mesh), geometry = mesh.geometry, indices = geometry.index?.array;
  const count = indices?.length ?? geometry.attributes.position.count;
  const material = mesh.material, color = material.color;
  const rgba = pixels.data;
  for (let i=0; i<count; i+=3) {
   const a=3*(indices?indices[i]:i), b=3*(indices?indices[i+1]:i+1), c=3*(indices?indices[i+2]:i+2);
   const ax=p[a], ay=p[a+1], az=p[a+2];
   const bx=p[b]-ax, by=p[b+1]-ay, bz=p[b+2]-az;
   const cx=p[c]-ax, cy=p[c+1]-ay, cz=p[c+2]-az;
   const area=bx*cy-by*cx;
   if (area>=-.00001) continue;
   const left=Math.max(0,Math.ceil(Math.min(ax,p[b],p[c])-.5)), right=Math.min(size-1,Math.floor(Math.max(ax,p[b],p[c])-.5));
   const top=Math.max(0,Math.ceil(Math.min(ay,p[b+1],p[c+1])-.5)), bottom=Math.min(size-1,Math.floor(Math.max(ay,p[b+1],p[c+1])-.5));
   if (left>right || top>bottom) continue;
   // Convert projected edge lengths back to equal scene units for lighting.
   const zScale = 29.9*size/(2*3.23);
   const nx=(by*cz-bz*cy)*zScale, ny=(bx*cz-bz*cx)*zScale, nz=-area;
   const norm=1/Math.hypot(nx,ny,nz);
   const key=Math.max(0,(-.424*nx+.251*ny+.870*nz)*norm);
   const rim=Math.max(0,(.469*nx+.871*ny-.15*nz)*norm);
   const r=channel(color.r*(.58+1.5*key+.65*rim));
   const g=channel(color.g*(.62+1.37*key+.76*rim));
   const bl=channel(color.b*(.75+1.12*key+rim));
   for (let y=top;y<=bottom;y++) for(let x=left;x<=right;x++) {
    const dx=x+.5-ax,dy=y+.5-ay;
    const u=(dx*cy-dy*cx)/area,v=(bx*dy-by*dx)/area;
    if (u<0 || v<0 || u+v>1) continue;
    const z=az+u*bz+v*cz, index=y*size+x;
    if(z>=depth[index]) continue;
    depth[index]=z;
    const j=index*4; rgba[j]=r; rgba[j+1]=g; rgba[j+2]=bl; rgba[j+3]=255;
   }
  }
 }
 return {domElement,render(scene,camera) {
  scene.updateMatrixWorld(true);
  view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  depth.fill(Infinity); pixels.data.fill(0);
  scene.traverseVisible(node=>{if(node.isMesh) drawMesh(node);});
  ctx.putImageData(pixels,0,0);
 }};
}
