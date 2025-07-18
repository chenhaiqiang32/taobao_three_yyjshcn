import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { getModelByName, getDefaultModel } from "./modelList.js";

export function loadModel(scene, modelName = null, targetGroup = null) {
  return new Promise((resolve, reject) => {
    // 获取模型信息
    let modelInfo;
    if (modelName) {
      modelInfo = getModelByName(modelName);
      if (!modelInfo) {
        reject(new Error(`Model "${modelName}" not found in model list`));
        return;
      }
    } else {
      // 如果没有指定模型名称，使用默认模型
      modelInfo = getDefaultModel();
      if (!modelInfo) {
        reject(new Error("No models available"));
        return;
      }
    }

    console.log(`🎯 Loading model: ${modelInfo.name} (${modelInfo.size})`);

    const loader = new GLTFLoader();

    // 创建 DRACOLoader 实例
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("./draco/");

    // 将 DRACOLoader 实例设置给 GLTFLoader
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      modelInfo.path, // 使用动态模型路径
      function (gltf) {
        const model = gltf.scene;

        // 计算模型的包围盒
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const radius = Math.max(size.x, size.y, size.z);

        // 创建动画混合器但不自动播放
        let mixer = null;
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          // 不自动播放动画，由外部控制
        }

        // 恢复原始材质，确保模型正常显示
        model.traverse((child) => {
          if (child.isMesh) {
            child.visible = true;
          }
        });

        // 设置模型的用户数据，用于后续识别
        model.userData.modelName = modelInfo.name;
        model.userData.modelInfo = modelInfo;

        // 将模型添加到场景或指定分组
        if (targetGroup) {
          targetGroup.add(model);
        } else {
          scene.add(model);
        }

        console.log(`✅ Model "${modelInfo.name}" loaded successfully`);

        // 返回模型信息
        resolve({
          model: model,
          boundingBox: box,
          center: center, // 包围盒中心
          size: size, // 包围盒大小
          radius: radius, // 包围盒半径
          mixer: mixer, // 返回动画混合器
          animations: gltf.animations, // 返回动画数据
          modelInfo: modelInfo, // 返回模型信息
        });
      },
      function (xhr) {
        const percentage = xhr.total
          ? ((xhr.loaded / xhr.total) * 100).toFixed(1)
          : "unknown";
        console.log(`📦 Loading ${modelInfo.name}: ${percentage}%`);
      },
      function (error) {
        console.error(`❌ Error loading model "${modelInfo.name}":`, error);
        reject(error);
      }
    );
  });
}

// 新增：加载所有模型的函数
export function loadAllModels(scene) {
  return Promise.all([
    loadModel(scene, "che"),
    loadModel(scene, "dixing"),
    loadModel(scene, "jianzhu"),
    loadModel(scene, "shu"),
  ]);
}

// 新增：清除场景中的模型
export function clearModels(scene) {
  const modelsToRemove = [];
  scene.traverse((child) => {
    if (child.isMesh || child.isGroup) {
      if (child.parent === scene) {
        modelsToRemove.push(child);
      }
    }
  });

  modelsToRemove.forEach((model) => {
    scene.remove(model);
    // 清理几何体和材质
    if (model.geometry) {
      model.geometry.dispose();
    }
    if (model.material) {
      if (Array.isArray(model.material)) {
        model.material.forEach((mat) => mat.dispose());
      } else {
        model.material.dispose();
      }
    }
  });
}
