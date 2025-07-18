import * as THREE from "three";

class MemoryManager {
  static dispose(object) {
    if (!object) return;

    // 递归遍历对象的所有子对象
    if (object.traverse) {
      object.traverse((child) => {
        this.disposeObject(child);
      });
    }

    // 清理对象本身
    this.disposeObject(object);

    // 从父对象中移除
    if (object.parent) {
      object.parent.remove(object);
    }
  }

  static disposeObject(object) {
    if (!object) return;

    // 清理几何体
    if (object.geometry) {
      object.geometry.dispose();
    }

    // 清理材质
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => this.disposeMaterial(material));
      } else {
        this.disposeMaterial(object.material);
      }
    }

    // 清理纹理
    if (object.texture) {
      object.texture.dispose();
    }

    // 清理渲染目标
    if (object.renderTarget) {
      object.renderTarget.dispose();
    }
  }

  static disposeMaterial(material) {
    if (!material) return;

    // 清理材质的纹理
    const textureProperties = [
      "map",
      "lightMap",
      "bumpMap",
      "normalMap",
      "specularMap",
      "envMap",
      "alphaMap",
      "aoMap",
      "displacementMap",
      "emissiveMap",
      "gradientMap",
      "metalnessMap",
      "roughnessMap",
      "clearcoatMap",
      "clearcoatNormalMap",
      "clearcoatRoughnessMap",
      "transmissionMap",
      "thicknessMap",
      "sheenColorMap",
      "sheenRoughnessMap",
      "specularIntensityMap",
      "specularColorMap",
      "iridescenceMap",
      "iridescenceThicknessMap",
    ];

    textureProperties.forEach((prop) => {
      if (material[prop] && material[prop].dispose) {
        material[prop].dispose();
      }
    });

    // 清理材质本身
    material.dispose();
  }
}

export default MemoryManager;
