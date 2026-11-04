import * as THREE from "three";
export function cardMesh(front: THREE.Texture, back: THREE.Texture, width = 2.5, height = 3.4375): THREE.Group {
  const group = new THREE.Group();
  const frontMat = new THREE.MeshBasicMaterial({ map: front, side: THREE.FrontSide });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), frontMat);
  face.position.z = .025;
  const reverse = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: back }));
  reverse.rotation.y = Math.PI; reverse.position.z = -.025;
  const edges = new THREE.Mesh(new THREE.BoxGeometry(width-.015,height-.015,.02), new THREE.MeshBasicMaterial({ color: "#e3e0cd" }));
  group.add(edges, face, reverse);
  return group;
}
export function loadTexture(loader: THREE.TextureLoader, url: string) {
  const texture = loader.load(url); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; return texture;
}
export function disposeScene(scene: THREE.Scene) {
  const textures = new Set<THREE.Texture>();
  scene.traverse((item) => {
    if (item instanceof THREE.Mesh || item instanceof THREE.Points) {
      item.geometry.dispose();
      for (const material of Array.isArray(item.material) ? item.material : [item.material]) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        material.dispose();
      }
    }
  });
  textures.forEach((texture) => texture.dispose());
}
export const smooth = (t: number) => { const x = Math.max(0,Math.min(1,t)); return x*x*(3-2*x); };
