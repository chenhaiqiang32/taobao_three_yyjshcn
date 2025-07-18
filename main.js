import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
// SMAA 相关依赖
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { loadModel, loadAllModels, clearModels } from "./modelLoader.js";
import { modelList, getModelNames } from "./modelList.js";
import {
  cameraConfig,
  renderConfig,
  easingFunctions,
  vegetationConfig,
} from "./config.js";
import BoxModel from "./src/components/boxModel.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
// 移除 ez-tree 导入，只使用简单的备用树木

// 创建场景
const scene = new THREE.Scene();

// 创建渲染器
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
  alpha: true,
  powerPreference: "high-performance",
  stencil: false,
  depth: true,
  logarithmicDepthBuffer: true, // 启用对数深度缓冲
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
// 设置设备像素比，提高渲染质量
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3)); // 使用更高的像素比以减少操作时的锯齿
// 启用更高质量的阴影
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// 启用更高质量的纹理过滤
renderer.physicallyCorrectLights = true;
// 设置输出编码
renderer.outputColorSpace = THREE.SRGBColorSpace;
// 启用色调映射
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// 设置ROOM环境
const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(
  new RoomEnvironment(),
  0.04
).texture;
pmremGenerator.dispose(); // 清理PMREMGenerator资源

// 加载HDR环境贴图作为背景
const textureLoader = new THREE.TextureLoader();
const backgroundTexture = textureLoader.load("./sunny2.jpg");
// 设置色彩空间为sRGB，降低饱和度和亮度
backgroundTexture.colorSpace = THREE.SRGBColorSpace;
backgroundTexture.generateMipmaps = false;
backgroundTexture.magFilter = THREE.LinearFilter;
backgroundTexture.minFilter = THREE.LinearFilter;

// 创建自定义着色器材质来精确控制背景色彩
const backgroundGeometry = new THREE.SphereGeometry(500, 32, 32);
const backgroundMaterial = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: backgroundTexture },
    brightness: { value: 1 }, // 降低亮度
    saturation: { value: 1 }, // 降低饱和度
    contrast: { value: 1 }, // 稍微降低对比度
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float brightness;
    uniform float saturation;
    uniform float contrast;
    varying vec2 vUv;
    
    vec3 adjustSaturation(vec3 color, float saturation) {
      vec3 luminance = vec3(0.299, 0.587, 0.114);
      float grey = dot(color, luminance);
      return mix(vec3(grey), color, saturation);
    }
    
    void main() {
      vec4 texColor = texture2D(tDiffuse, vUv);
      
      // 调整亮度
      vec3 color = texColor.rgb * brightness;
      
      // 调整饱和度
      color = adjustSaturation(color, saturation);
      
      // 调整对比度
      color = (color - 0.5) * contrast + 0.5;
      
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  side: THREE.BackSide,
  depthWrite: false,
  depthTest: false,
});
const backgroundSphere = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
backgroundSphere.renderOrder = -1; // 确保背景最先渲染
scene.add(backgroundSphere);

// 创建相机
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.01, // 降低near平面值以防止模型被裁剪
  1000
);

// 添加轨道控制器
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = cameraConfig.controls.enableDamping;
controls.dampingFactor = cameraConfig.controls.dampingFactor;
controls.enablePan = cameraConfig.controls.enablePan;
controls.enableZoom = cameraConfig.controls.enableZoom;
controls.enableRotate = cameraConfig.controls.enableRotate;
controls.maxPolarAngle = cameraConfig.controls.maxPolarAngle;
controls.minDistance = cameraConfig.controls.minDistance;
controls.maxDistance = cameraConfig.controls.maxDistance;

// 动画混合器变量数组 - 支持多个模型的动画
let mixers = [];
let animationActions = [];
let isAnimationPlaying = false;

// 存储加载的模型信息
let loadedModels = [];

// 创建模型分组
let modelsGroup = new THREE.Group();

// 将模型分组添加到场景
scene.add(modelsGroup);

// 创建地面效果实例
let groundEffect = null;

// 植被相关变量
let vegetationGroup = null;
let dixingModel = null;
let windTime = 0; // 风效果时间变量

// 射线检测相关变量
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let jianzhuModel = null; // 建筑模型引用
let highlightedMesh = null; // 当前高亮的网格
let outlinePass = null; // 外轮廓效果
let composer = null; // 效果合成器
let currentScene = 0; // 当前场景索引
let scenes = []; // 场景数组
let buildingTip = null; // 建筑提示元素

// UI控制变量
let loadingOverlay, loadingProgress, modelControlsContainer;

// 相机动画变量
let cameraAnimation = {
  isAnimating: false,
  startTime: 0,
  startPosition: new THREE.Vector3(),
  targetPosition: new THREE.Vector3(),
  startTarget: new THREE.Vector3(),
  targetTarget: new THREE.Vector3(),
};

// 初始化外轮廓效果
function initOutlineEffect() {
  // 创建效果合成器
  composer = new EffectComposer(renderer);

  // 添加渲染通道
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 添加外轮廓通道
  outlinePass = new OutlinePass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    scene,
    camera
  );

  // 设置外轮廓参数
  outlinePass.edgeStrength = 3.0; // 边缘强度
  outlinePass.edgeGlow = 0.8; // 发光强度
  outlinePass.edgeThickness = 1.0; // 边缘厚度（推荐更细）
  outlinePass.pulsePeriod = 1; // 脉冲周期
  outlinePass.visibleEdgeColor.set(new THREE.Color("#4e72b8")); // 可见边缘颜色（绿色）
  outlinePass.hiddenEdgeColor.set(new THREE.Color("#1d953f")); // 隐藏边缘颜色（蓝色）

  composer.addPass(outlinePass);

  // 移除 FXAA，添加 SMAA 抗锯齿后处理通道
  // const fxaaPass = new ShaderPass(FXAAShader);
  // const pixelRatio = renderer.getPixelRatio();
  // fxaaPass.material.uniforms["resolution"].value.x =
  //   1 / (window.innerWidth * pixelRatio);
  // fxaaPass.material.uniforms["resolution"].value.y =
  //   1 / (window.innerHeight * pixelRatio);
  // composer.addPass(fxaaPass);

  // 创建 SMAA Pass 并设置高质量抗锯齿
  const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);

  // SMAA Pass 会自动设置其内部材质和uniforms
  // 我们只需要确保分辨率正确设置
  console.log(
    "🔧 SMAA Pass created with resolution:",
    window.innerWidth,
    "x",
    window.innerHeight
  );

  composer.addPass(smaaPass);

  // 添加动态抗锯齿后处理通道
  const dynamicAntiAliasingPass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      resolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      time: { value: 0.0 },
      motionFactor: { value: 0.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform float time;
      uniform float motionFactor;
      varying vec2 vUv;
      
      void main() {
        vec2 texelSize = 1.0 / resolution;
        vec4 color = texture2D(tDiffuse, vUv);
        
        // 多方向采样，处理动态锯齿
        vec4 samples[9];
        samples[0] = texture2D(tDiffuse, vUv + vec2(-texelSize.x, -texelSize.y));
        samples[1] = texture2D(tDiffuse, vUv + vec2(0.0, -texelSize.y));
        samples[2] = texture2D(tDiffuse, vUv + vec2(texelSize.x, -texelSize.y));
        samples[3] = texture2D(tDiffuse, vUv + vec2(-texelSize.x, 0.0));
        samples[4] = color;
        samples[5] = texture2D(tDiffuse, vUv + vec2(texelSize.x, 0.0));
        samples[6] = texture2D(tDiffuse, vUv + vec2(-texelSize.x, texelSize.y));
        samples[7] = texture2D(tDiffuse, vUv + vec2(0.0, texelSize.y));
        samples[8] = texture2D(tDiffuse, vUv + vec2(texelSize.x, texelSize.y));
        
        // 计算边缘强度
        float edge = 0.0;
        for(int i = 0; i < 9; i++) {
          if(i != 4) {
            edge += abs(color.r - samples[i].r);
          }
        }
        edge /= 8.0;
        
        // 动态抗锯齿：根据边缘强度、时间和运动因子应用不同程度的模糊
        float dynamicThreshold = 0.2 + motionFactor * 0.3; // 运动时降低阈值
        if(edge > dynamicThreshold) {
          // 计算加权平均（增强模糊权重）
          vec4 blurred = color * 0.4;
          blurred += samples[1] * 0.1;
          blurred += samples[3] * 0.1;
          blurred += samples[5] * 0.1;
          blurred += samples[7] * 0.1;
          blurred += samples[0] * 0.05;
          blurred += samples[2] * 0.05;
          blurred += samples[6] * 0.05;
          blurred += samples[8] * 0.05;
          
          // 根据边缘强度和运动因子调整混合比例
          float blendFactor = min(edge * 2.0 + motionFactor * 0.5, 1.0);
          color = mix(color, blurred, blendFactor);
        }
        
        gl_FragColor = color;
      }
    `,
  });
  composer.addPass(dynamicAntiAliasingPass);

  // 设置合成器的像素比（提高抗锯齿质量）
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 4)); // 使用更高的像素比以获得更好的抗锯齿效果
  composer.setSize(window.innerWidth, window.innerHeight);

  console.log("✨ 外轮廓效果、高质量SMAA和动态抗锯齿已初始化");
}

// 射线检测函数
function onMouseMove(event) {
  // 计算鼠标位置
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // 更新射线
  raycaster.setFromCamera(mouse, camera);

  // 检查与建筑模型的相交
  if (jianzhuModel) {
    const intersects = raycaster.intersectObjects(jianzhuModel.children, true);

    if (intersects.length > 0) {
      const intersectedMesh = intersects[0].object;

      // 如果点击的是建筑模型的网格
      if (intersectedMesh.isMesh && intersectedMesh.userData.isJianzhu) {
        if (highlightedMesh !== intersectedMesh) {
          // 清除之前的高亮
          if (highlightedMesh) {
            outlinePass.selectedObjects = [];
          }

          // 设置新的高亮 - 将整个建筑的所有mesh都添加到外轮廓中
          highlightedMesh = intersectedMesh;
          outlinePass.selectedObjects = window.jianzhuMeshes || [];

          // 设置鼠标样式为小手
          renderer.domElement.style.cursor = "pointer";

          // 显示建筑提示
          if (buildingTip) {
            buildingTip.classList.add("show");
          }

          console.log(
            "✨ 建筑高亮:, highlightedMesh.name ||未命名网格",
            "外轮廓对象数量:",
            outlinePass.selectedObjects.length
          );
        }
      } else {
        // 清除高亮
        if (highlightedMesh) {
          outlinePass.selectedObjects = [];
          highlightedMesh = null;
        }

        // 恢复默认鼠标样式
        renderer.domElement.style.cursor = "default";

        // 隐藏建筑提示
        if (buildingTip) {
          buildingTip.classList.remove("show");
        }
      }
    } else {
      // 清除高亮
      if (highlightedMesh) {
        outlinePass.selectedObjects = [];
        highlightedMesh = null;
      }

      // 恢复默认鼠标样式
      renderer.domElement.style.cursor = "default";

      // 隐藏建筑提示
      if (buildingTip) {
        buildingTip.classList.remove("show");
      }
    }
  }
}

// 双击切换场景函数
function onDoubleClick(event) {
  // 计算鼠标位置
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // 更新射线
  raycaster.setFromCamera(mouse, camera);

  // 检查与建筑模型的相交
  if (jianzhuModel) {
    const intersects = raycaster.intersectObjects(jianzhuModel.children, true);

    if (intersects.length > 0) {
      const intersectedMesh = intersects[0].object;

      // 如果双击的是建筑模型的网格
      if (intersectedMesh.isMesh && intersectedMesh.userData.isJianzhu) {
        // 隐藏建筑提示
        if (buildingTip) {
          buildingTip.classList.remove("show");
        }

        // 切换到下一个场景
        currentScene = (currentScene + 1) % scenes.length;
        switchToScene(currentScene);
        console.log(`🏗️ 切换到场景 ${currentScene + 1}`);
      }
    }
  }
}

// 切换场景函数
function switchToScene(sceneIndex) {
  if (sceneIndex >= 0 && sceneIndex < scenes.length) {
    // 隐藏所有场景
    scenes.forEach((scene, index) => {
      scene.visible = index === sceneIndex;
    });

    // 更新当前场景索引
    currentScene = sceneIndex;
  }
}

// 颜色增强配置函数
function getColorEnhancementConfig(modelName) {
  const configs = {
    che: {
      saturationMultiplier: 1.8, // 车辆：更鲜艳的颜色
      brightnessBoost: 1.3,
      hueShift: 0, // 不改变色相
      roughnessMultiplier: 0.6, // 更光滑，像汽车漆面
      metallicBoost: 0.2,
      emissiveBoost: 2.0,
    },
    dixing: {
      saturationMultiplier: 1.4, // 地形：自然但鲜明
      brightnessBoost: 1.1,
      hueShift: 0.02, // 稍微偏向绿色
      roughnessMultiplier: 0.9,
      metallicBoost: 0,
      emissiveBoost: 1.2,
    },
    jianzhu: {
      saturationMultiplier: 1.7, // 建筑：强烈的对比
      brightnessBoost: 1.25,
      hueShift: -0.01, // 稍微偏向暖色
      roughnessMultiplier: 0.7,
      metallicBoost: 0.1,
      emissiveBoost: 1.8,
    },
    shu: {
      saturationMultiplier: 1.5, // 树木：生机勃勃的绿色
      brightnessBoost: 1.15,
      hueShift: 0.03, // 偏向绿色
      roughnessMultiplier: 0.85,
      metallicBoost: 0,
      emissiveBoost: 1.3,
    },
  };

  return (
    configs[modelName] || {
      saturationMultiplier: 1.6,
      brightnessBoost: 1.2,
      hueShift: 0,
      roughnessMultiplier: 0.8,
      metallicBoost: 0.1,
      emissiveBoost: 1.5,
    }
  );
}

// 植被生成功能
function generateVegetationOnTerrain(terrainModel, scene) {
  // 检查植被配置是否启用
  if (!vegetationConfig.enabled) {
    console.log("🌱 Vegetation generation is disabled in config");
    // 返回一个空的植被组
    const emptyGroup = new THREE.Group();
    emptyGroup.name = "vegetation_disabled";
    return emptyGroup;
  }

  if (!terrainModel) {
    console.warn("⚠️ No terrain model found for vegetation generation");
    // 返回一个空的植被组
    const emptyGroup = new THREE.Group();
    emptyGroup.name = "vegetation_no_terrain";
    return emptyGroup;
  }

  // 获取地形模型的包围盒
  const terrainBox = new THREE.Box3().setFromObject(terrainModel);
  const terrainCenter = terrainBox.getCenter(new THREE.Vector3());
  const terrainSize = terrainBox.getSize(new THREE.Vector3());

  console.log("🌱 Generating vegetation on terrain:", {
    center: terrainCenter,
    size: terrainSize,
    min: terrainBox.min,
    max: terrainBox.max,
  });

  // 根据生成模式选择不同的生成方法
  if (vegetationConfig.generationMode === "coordinates") {
    return generateVegetationFromCoordinates(scene);
  } else {
    return generateVegetationRandomly(terrainBox, scene);
  }
}

// 基于坐标数据生成植被
async function generateVegetationFromCoordinates(scene) {
  console.log("🌳 Using coordinates-based vegetation generation...");

  try {
    // 读取坐标数据文件
    const response = await fetch(vegetationConfig.coordinatesFile);
    if (!response.ok) {
      throw new Error(`Failed to load coordinates file: ${response.status}`);
    }

    const treeData = await response.json();
    console.log(
      `📍 Loaded ${treeData.totalTrees} tree positions from ${treeData.sourceModel}`
    );

    const vegetationGroup = new THREE.Group();
    vegetationGroup.name = "vegetation_from_coordinates";

    let generatedCount = 0;

    // 遍历所有坐标位置
    for (const treePos of treeData.positions) {
      // 检查是否超过最大植被总数
      if (generatedCount >= vegetationConfig.performance.maxTotalVegetation) {
        console.warn(
          `⚠️ Reached maximum vegetation count (${vegetationConfig.performance.maxTotalVegetation})`
        );
        break;
      }

      try {
        // 根据坐标数据中的类型选择配置
        const treeConfig = getTreeConfigByType(treePos.type);
        if (!treeConfig) {
          console.warn(`⚠️ Unknown tree type: ${treePos.type}, skipping`);
          continue;
        }

        // 直接创建简单的备用树木
        const finalTree = createFallbackTree(treeConfig);

        // 设置位置（使用原始坐标）
        finalTree.position.set(
          treePos.position.x,
          treePos.position.y,
          treePos.position.z
        );

        // 设置旋转（使用原始旋转或随机旋转）
        if (vegetationConfig.appearance.enableRandomRotation) {
          finalTree.rotation.y = Math.random() * Math.PI * 2;
        } else if (treePos.rotation) {
          finalTree.setRotationFromQuaternion(
            new THREE.Quaternion(
              treePos.rotation.x,
              treePos.rotation.y,
              treePos.rotation.z,
              treePos.rotation.w
            )
          );
        }

        // 使用原始缩放或配置的缩放范围
        let scale = 1.0;
        if (
          treePos.scale &&
          (treePos.scale.x || treePos.scale.y || treePos.scale.z)
        ) {
          scale = Math.max(treePos.scale.x, treePos.scale.y, treePos.scale.z);
        } else {
          const scaleMin = vegetationConfig.appearance.scaleRange.min;
          const scaleMax = vegetationConfig.appearance.scaleRange.max;
          scale = scaleMin + Math.random() * (scaleMax - scaleMin);
        }
        finalTree.scale.setScalar(scale);

        // 根据配置设置阴影
        if (vegetationConfig.appearance.enableShadows) {
          finalTree.castShadow = true;
          finalTree.receiveShadow = false;

          finalTree.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = false;
            }
          });
        }

        // 添加风效果数据到用户数据中
        if (treeConfig.windEffect && treeConfig.windEffect.enabled) {
          finalTree.userData.windEffect = {
            enabled: true,
            intensity: treeConfig.windEffect.intensity,
            frequency: treeConfig.windEffect.frequency,
            originalRotation: finalTree.rotation.clone(),
            originalPosition: finalTree.position.clone(),
          };
        }

        // 添加到植被组
        vegetationGroup.add(finalTree);
        generatedCount++;
      } catch (error) {
        console.warn(
          `⚠️ Failed to generate tree at position ${treePos.name}:`,
          error
        );
      }
    }

    // 将植被组添加到场景
    scene.add(vegetationGroup);

    console.log(`🌳 Generated ${generatedCount} trees from coordinate data`);
    return vegetationGroup;
  } catch (error) {
    console.error(
      "❌ Failed to load coordinates data, falling back to random generation:",
      error
    );
    // 降级到随机生成
    return generateVegetationRandomly(null, scene);
  }
}

// 根据类型获取树木配置
function getTreeConfigByType(type) {
  return (
    vegetationConfig.types.find(
      (config) =>
        config.enabled && (config.type === type || config.name === type)
    ) || vegetationConfig.types.find((config) => config.enabled)
  ); // 如果找不到匹配类型，返回第一个启用的配置
}

// 随机生成植被（原有的逻辑）
function generateVegetationRandomly(terrainBox, scene) {
  console.log("🌱 Using random vegetation generation...");

  // 如果没有传入terrainBox，需要重新计算
  if (!terrainBox) {
    const terrainModel = modelsGroup.children.find(
      (child) =>
        child.userData &&
        child.userData.modelName === vegetationConfig.terrainModelName
    );
    if (!terrainModel) {
      console.warn("⚠️ No terrain model found for random generation");
      // 返回一个空的植被组而不是undefined
      const emptyGroup = new THREE.Group();
      emptyGroup.name = "vegetation_empty";
      return emptyGroup;
    }
    terrainBox = new THREE.Box3().setFromObject(terrainModel);
  }

  const terrainCenter = terrainBox.getCenter(new THREE.Vector3());
  const terrainSize = terrainBox.getSize(new THREE.Vector3());

  // 从配置文件获取启用的树木配置
  const treeConfigs = vegetationConfig.types.filter((config) => config.enabled);

  const vegetationGroup = new THREE.Group();
  vegetationGroup.name = "vegetation_random";

  // 设置随机种子（如果配置中指定了）
  if (vegetationConfig.generation.randomSeed !== null) {
    Math.seedrandom(vegetationConfig.generation.randomSeed);
  }

  // 计算实际生成范围
  const edgeMinDist = vegetationConfig.generation.minDistanceFromEdge;
  const edgeMaxDist = vegetationConfig.generation.maxDistanceFromEdge;
  const actualMinX = terrainBox.min.x + terrainSize.x * edgeMinDist;
  const actualMaxX = terrainBox.min.x + terrainSize.x * edgeMaxDist;
  const actualMinZ = terrainBox.min.z + terrainSize.z * edgeMinDist;
  const actualMaxZ = terrainBox.min.z + terrainSize.z * edgeMaxDist;

  let totalVegetationCount = 0;

  treeConfigs.forEach((config, configIndex) => {
    for (let i = 0; i < config.count; i++) {
      // 检查是否超过最大植被总数
      if (
        totalVegetationCount >= vegetationConfig.performance.maxTotalVegetation
      ) {
        console.warn(
          `⚠️ Reached maximum vegetation count (${vegetationConfig.performance.maxTotalVegetation})`
        );
        return;
      }

      try {
        // 在配置的生成范围内随机生成位置
        const x = actualMinX + Math.random() * (actualMaxX - actualMinX);
        const z = actualMinZ + Math.random() * (actualMaxZ - actualMinZ);

        // 使用配置的高度偏移
        const y = terrainBox.min.y + vegetationConfig.generation.heightOffset;

        // 直接创建简单的备用树木
        const finalTree = createFallbackTree(config);

        // 设置位置
        finalTree.position.set(x, y, z);

        // 根据配置决定是否随机旋转
        if (vegetationConfig.appearance.enableRandomRotation) {
          finalTree.rotation.y = Math.random() * Math.PI * 2;
        }

        // 使用配置的缩放范围
        const scaleMin = vegetationConfig.appearance.scaleRange.min;
        const scaleMax = vegetationConfig.appearance.scaleRange.max;
        const scale = scaleMin + Math.random() * (scaleMax - scaleMin);
        finalTree.scale.setScalar(scale);

        // 根据配置设置阴影
        if (vegetationConfig.appearance.enableShadows) {
          finalTree.castShadow = true;
          finalTree.receiveShadow = false;

          // 遍历树的子对象设置阴影
          finalTree.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = false;
            }
          });
        }

        // 添加风效果数据到用户数据中
        if (config.windEffect && config.windEffect.enabled) {
          finalTree.userData.windEffect = {
            enabled: true,
            intensity: config.windEffect.intensity,
            frequency: config.windEffect.frequency,
            originalRotation: finalTree.rotation.clone(),
            originalPosition: finalTree.position.clone(),
          };
        }

        // 添加到植被组
        vegetationGroup.add(finalTree);
        totalVegetationCount++;
      } catch (error) {
        console.warn(
          `⚠️ Failed to generate tree ${i} of config ${configIndex}:`,
          error
        );
      }
    }
  });

  // 将植被组添加到场景
  scene.add(vegetationGroup);

  console.log(
    `🌳 Generated ${vegetationGroup.children.length} vegetation objects on terrain`
  );

  return vegetationGroup;
}

// 创建简单的树木（使用Three.js基础几何体）
function createFallbackTree(config) {
  const treeGroup = new THREE.Group();

  // 创建树干
  const trunkGeometry = new THREE.CylinderGeometry(
    config.trunkRadius * 0.7, // 顶部半径
    config.trunkRadius, // 底部半径
    config.trunkLength, // 高度
    8 // 径向分段
  );
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: config.trunkColor,
    roughness: 0.9,
    metalness: 0.0,
  });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = config.trunkLength / 2;
  treeGroup.add(trunk);

  // 创建树冠（灌木使用更小的球形）
  let crownGeometry;
  if (config.type === "bush") {
    // 灌木使用小球形
    crownGeometry = new THREE.SphereGeometry(
      config.trunkLength * 0.8, // 半径
      6, // 经度分段
      4 // 纬度分段
    );
  } else if (config.type === "conifer") {
    // 针叶树使用锥形
    crownGeometry = new THREE.ConeGeometry(
      config.trunkLength * 0.6, // 半径
      config.trunkLength * 0.8, // 高度
      8 // 径向分段
    );
  } else {
    // 落叶树使用球形
    crownGeometry = new THREE.SphereGeometry(
      config.trunkLength * 0.5, // 半径
      8, // 经度分段
      6 // 纬度分段
    );
  }

  const crownMaterial = new THREE.MeshStandardMaterial({
    color: config.leafColor,
    roughness: 0.8,
    metalness: 0.1,
  });
  const crown = new THREE.Mesh(crownGeometry, crownMaterial);
  crown.position.y = config.trunkLength * 0.6; // 降低树冠位置
  treeGroup.add(crown);

  console.log(`🌳 Created fallback tree of type: ${config.type}`);

  return treeGroup;
}

// 应用风效果到植被
function applyWindEffect(vegetationGroup, deltaTime) {
  if (!vegetationGroup || typeof vegetationGroup.traverse !== "function") {
    return;
  }

  windTime += deltaTime;

  vegetationGroup.traverse((child) => {
    if (
      child.userData &&
      child.userData.windEffect &&
      child.userData.windEffect.enabled
    ) {
      const windEffect = child.userData.windEffect;

      // 计算风摆动 - 增强效果
      const windOffset =
        Math.sin(windTime * windEffect.frequency) * windEffect.intensity;
      const windRotation =
        Math.sin(windTime * windEffect.frequency * 0.7) *
        windEffect.intensity *
        0.8; // 增加旋转幅度

      // 应用风效果到位置和旋转 - 增强位移效果
      child.position.x =
        child.userData.windEffect.originalPosition.x + windOffset * 0.3;
      child.position.z =
        child.userData.windEffect.originalPosition.z + windOffset * 0.15;
      child.rotation.z =
        child.userData.windEffect.originalRotation.z + windRotation;

      // 添加轻微的Y轴摆动
      child.rotation.y =
        child.userData.windEffect.originalRotation.y +
        Math.sin(windTime * windEffect.frequency * 0.5) *
          windEffect.intensity *
          0.2;
    }
  });
}

// 清除植被功能
function clearVegetation() {
  if (vegetationGroup) {
    // 清理几何体和材质
    vegetationGroup.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });

    // 从场景中移除
    scene.remove(vegetationGroup);
    console.log("🗑️ Vegetation cleared");
    vegetationGroup = null;
  }
}

// 初始化UI元素
function initUI() {
  loadingOverlay = document.getElementById("loadingOverlay");
  loadingProgress = document.getElementById("loadingProgress");
  modelControlsContainer = document.getElementById("modelControls");
  buildingTip = document.getElementById("buildingTip");

  // 生成模型控制项
  generateModelControls();

  // 添加模型控制事件监听器
  setupModelControlEvents();
}

// 生成模型控制项
function generateModelControls() {
  if (!modelControlsContainer) return;

  modelControlsContainer.innerHTML = "";

  modelList.forEach((model, index) => {
    const modelItem = document.createElement("div");
    modelItem.className = "model-item";

    modelItem.innerHTML = `
      <input type="checkbox" id="model-${model.name}" class="model-checkbox" checked>
      <label for="model-${model.name}" class="model-label">${model.name}</label>
      <span class="model-size">${model.size}</span>
    `;

    modelControlsContainer.appendChild(modelItem);
  });
}

// 设置模型控制事件
function setupModelControlEvents() {
  // 显示全部按钮
  const showAllButton = document.getElementById("showAllButton");
  if (showAllButton) {
    showAllButton.addEventListener("click", () => {
      modelsGroup.children.forEach((model) => {
        model.visible = true;
      });
      // 更新复选框状态
      document.querySelectorAll(".model-checkbox").forEach((checkbox) => {
        checkbox.checked = true;
      });
      console.log("📍 All models shown");
    });
  }

  // 隐藏全部按钮
  const hideAllButton = document.getElementById("hideAllButton");
  if (hideAllButton) {
    hideAllButton.addEventListener("click", () => {
      modelsGroup.children.forEach((model) => {
        model.visible = false;
      });
      // 更新复选框状态
      document.querySelectorAll(".model-checkbox").forEach((checkbox) => {
        checkbox.checked = false;
      });
      console.log("🙈 All models hidden");
    });
  }

  // 单个模型控制
  modelList.forEach((model) => {
    const checkbox = document.getElementById(`model-${model.name}`);
    if (checkbox) {
      checkbox.addEventListener("change", (e) => {
        // 通过模型名称在分组中查找对应的模型
        const targetModel = modelsGroup.children.find((child) => {
          // 通过用户数据或其他方式识别模型
          return child.userData && child.userData.modelName === model.name;
        });
        if (targetModel) {
          targetModel.visible = e.target.checked;
          console.log(
            `${e.target.checked ? "👁️" : "🙈"} Model "${model.name}" ${
              e.target.checked ? "shown" : "hidden"
            }`
          );
        }
      });
    }
  });
}

// 更新加载进度
function updateLoadingProgress(text) {
  if (loadingProgress) {
    loadingProgress.textContent = text;
  }
}

// 隐藏加载屏幕
function hideLoadingScreen() {
  if (loadingOverlay) {
    loadingOverlay.classList.add("hidden");
  }
}

// 计算基于包围盒的相机位置
function calculateCameraPosition(center, radius, distance, elevation, azimuth) {
  const actualDistance = radius * (distance / 100); // 将百分比转换为实际距离

  // 将角度转换为弧度
  const elevationRad = (elevation * Math.PI) / 180;
  const azimuthRad = (azimuth * Math.PI) / 180;

  // 计算相机位置
  const x =
    center.x + actualDistance * Math.cos(elevationRad) * Math.cos(azimuthRad);
  const y = center.y + actualDistance * Math.sin(elevationRad);
  const z =
    center.z + actualDistance * Math.cos(elevationRad) * Math.sin(azimuthRad);

  return new THREE.Vector3(x, y, z);
}

// 开始相机动画
function startCameraAnimation(
  fromPosition,
  toPosition,
  fromTarget,
  toTarget,
  duration = 3000
) {
  cameraAnimation.isAnimating = true;
  cameraAnimation.startTime = performance.now();
  cameraAnimation.startPosition.copy(fromPosition);
  cameraAnimation.targetPosition.copy(toPosition);
  cameraAnimation.startTarget.copy(fromTarget);
  cameraAnimation.targetTarget.copy(toTarget);

  console.log("🎬 Starting camera animation:", {
    from: fromPosition,
    to: toPosition,
    duration: duration + "ms",
  });
}

// 更新相机动画
function updateCameraAnimation(currentTime) {
  if (!cameraAnimation.isAnimating) return;

  const elapsed = currentTime - cameraAnimation.startTime;
  const duration = cameraConfig.animation.duration;
  const progress = Math.min(elapsed / duration, 1);

  // 使用缓动函数
  const easingFunc =
    easingFunctions[cameraConfig.animation.easing] ||
    easingFunctions.easeOutCubic;
  const easedProgress = easingFunc(progress);

  // 插值相机位置
  camera.position.lerpVectors(
    cameraAnimation.startPosition,
    cameraAnimation.targetPosition,
    easedProgress
  );

  // 插值控制器目标
  const currentTarget = new THREE.Vector3().lerpVectors(
    cameraAnimation.startTarget,
    cameraAnimation.targetTarget,
    easedProgress
  );
  controls.target.copy(currentTarget);

  // 动画完成
  if (progress >= 1) {
    cameraAnimation.isAnimating = false;
    controls.enabled = true; // 重新启用控制器
    console.log("✅ Camera animation completed");
  }

  controls.update();
}

// 计算模型分组的包围盒
function calculateGroupBoundingBox(group) {
  if (!group || group.children.length === 0) return null;

  const box = new THREE.Box3();
  box.setFromObject(group);

  return box;
}

// 计算所有模型的总体包围盒（保留兼容性）
function calculateOverallBoundingBox(models) {
  if (models.length === 0) return null;

  const overallBox = new THREE.Box3();

  models.forEach((modelData) => {
    overallBox.expandByObject(modelData.model);
  });

  return overallBox;
}

// 初始化UI
document.addEventListener("DOMContentLoaded", initUI);

// 加载所有模型
console.log(`🚀 Starting to load ${modelList.length} models:`, getModelNames());
updateLoadingProgress(`正在加载 ${modelList.length} 个模型...`);

// 使用Promise.allSettled来处理部分加载失败的情况
let loadedCount = 0;
Promise.allSettled(
  modelList.map((model, index) => {
    return loadModel(scene, model.name, modelsGroup)
      .then((result) => {
        loadedCount++;
        updateLoadingProgress(
          `已加载 ${loadedCount}/${modelList.length} 个模型`
        );
        return result;
      })
      .catch((error) => {
        loadedCount++;
        updateLoadingProgress(
          `加载失败 ${loadedCount}/${modelList.length} 个模型`
        );
        throw error;
      });
  })
)
  .then((results) => {
    const successfulModels = [];
    const failedModels = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successfulModels.push(result.value);
      } else {
        failedModels.push({
          name: modelList[index].name,
          error: result.reason,
        });
      }
    });

    if (failedModels.length > 0) {
      console.warn(
        `⚠️ ${failedModels.length} models failed to load:`,
        failedModels
      );
    }

    if (successfulModels.length === 0) {
      console.error("❌ No models loaded successfully");
      return;
    }

    console.log(
      `✅ Successfully loaded ${successfulModels.length}/${modelList.length} models`
    );

    // 存储加载的模型
    loadedModels = successfulModels;

    // 计算模型分组的包围盒
    const groupBox = calculateGroupBoundingBox(modelsGroup);
    if (!groupBox) return;

    const center = groupBox.getCenter(new THREE.Vector3());
    const size = groupBox.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z);

    console.log("📦 Models group bounding box:", {
      中心点: center,
      大小: size,
      半径: radius,
      分组子对象数量: modelsGroup.children.length,
    });

    // 处理动画
    successfulModels.forEach((modelData) => {
      if (modelData.mixer) {
        mixers.push(modelData.mixer);

        if (modelData.animations && modelData.animations.length > 0) {
          modelData.animations.forEach((clip) => {
            const action = modelData.mixer.clipAction(clip);
            animationActions.push(action);
          });
        }
      }

      // 遍历模型，设置材质属性和阴影配置
      modelData.model.traverse((child) => {
        if (child.isMesh && child.material) {
          // 获取模型的阴影配置，如果没有则使用默认配置
          const shadowConfig =
            modelData.modelInfo.shadow || renderConfig.shadows.modelDefaults;

          // 设置阴影属性
          child.castShadow = shadowConfig.castShadow;
          child.receiveShadow = shadowConfig.receiveShadow;

          if (
            child.material.isMeshStandardMaterial ||
            child.material.isMeshPhysicalMaterial
          ) {
            // 克隆材质以避免影响其他使用相同材质的对象
            child.material = child.material.clone();

            // 获取该模型的颜色增强配置
            const colorConfig = getColorEnhancementConfig(
              modelData.modelInfo.name
            );

            // 颜色增强：根据模型类型调整
            if (child.material.color) {
              const originalColor = child.material.color;

              // 转换到HSL颜色空间进行调整
              const hsl = {};
              originalColor.getHSL(hsl);

              // 应用色相偏移
              hsl.h = (hsl.h + colorConfig.hueShift) % 1.0;
              if (hsl.h < 0) hsl.h += 1.0;

              // 增强饱和度 (根据模型类型)
              hsl.s = Math.min(1.0, hsl.s * colorConfig.saturationMultiplier);

              // 调整亮度 (增加对比度)
              if (hsl.l < 0.5) {
                // 暗色调整
                hsl.l = Math.max(
                  0.05,
                  hsl.l * (2.0 - colorConfig.brightnessBoost)
                );
              } else {
                // 亮色调整
                hsl.l = Math.min(0.95, hsl.l * colorConfig.brightnessBoost);
              }

              // 应用调整后的颜色
              child.material.color.setHSL(hsl.h, hsl.s, hsl.l);
            }

            // 增强发射光颜色 (如果有的话)
            if (
              child.material.emissive &&
              child.material.emissive.r +
                child.material.emissive.g +
                child.material.emissive.b >
                0
            ) {
              child.material.emissive.multiplyScalar(colorConfig.emissiveBoost);
            }

            // 调整粗糙度，让材质更有质感
            if (child.material.roughness !== undefined) {
              child.material.roughness = Math.max(
                0.05,
                child.material.roughness * colorConfig.roughnessMultiplier
              );
            }

            // 调整金属度
            if (
              child.material.metalness !== undefined &&
              colorConfig.metallicBoost > 0
            ) {
              child.material.metalness = Math.min(
                1.0,
                child.material.metalness + colorConfig.metallicBoost
              );
            }

            // 处理纹理贴图的颜色增强
            if (child.material.map) {
              // 增强纹理的饱和度和对比度
              child.material.map.colorSpace = THREE.SRGBColorSpace;
              child.material.map.generateMipmaps = true;
              child.material.map.magFilter = THREE.LinearFilter;
              child.material.map.minFilter = THREE.LinearMipmapLinearFilter;

              // 添加抗锯齿优化
              child.material.map.anisotropy =
                renderer.capabilities.getMaxAnisotropy();
            }

            // 增强法线贴图效果
            if (child.material.normalMap && child.material.normalScale) {
              child.material.normalScale.multiplyScalar(1.2);
            }

            // 根据配置设置金属属性
            child.material.envMapIntensity = renderConfig.environment.intensity;
            child.material.needsUpdate = true;

            // 设置阴影强度（通过材质的透明度影响阴影）
            if (
              shadowConfig.shadowIntensity !== undefined &&
              shadowConfig.shadowIntensity !== 1.0
            ) {
              child.material.opacity = shadowConfig.shadowIntensity;
              child.material.transparent = shadowConfig.shadowIntensity < 1.0;
            }
          }
        }
      });

      // 统计模型中设置了阴影的mesh数量
      let castShadowCount = 0;
      let receiveShadowCount = 0;
      modelData.model.traverse((child) => {
        if (child.isMesh) {
          if (child.castShadow) castShadowCount++;
          if (child.receiveShadow) receiveShadowCount++;
        }
      });

      // 获取该模型的颜色增强配置用于日志
      const modelColorConfig = getColorEnhancementConfig(
        modelData.modelInfo.name
      );

      console.log(
        `🌫️ Applied shadow config for "${modelData.modelInfo.name}": ` +
          `cast=${modelData.modelInfo.shadow?.castShadow} (${castShadowCount} meshes), ` +
          `receive=${modelData.modelInfo.shadow?.receiveShadow} (${receiveShadowCount} meshes), ` +
          `intensity=${modelData.modelInfo.shadow?.shadowIntensity}`
      );

      console.log(
        `🎨 Applied color enhancement for "${modelData.modelInfo.name}": ` +
          `saturation=${modelColorConfig.saturationMultiplier}x, ` +
          `brightness=${modelColorConfig.brightnessBoost}x, ` +
          `hueShift=${modelColorConfig.hueShift.toFixed(3)}, ` +
          `roughness=${modelColorConfig.roughnessMultiplier}x`
      );
    });

    console.log(
      `🎬 Initialized ${animationActions.length} animations from ${mixers.length} mixers`
    );

    // 特殊处理建筑模型 - 为射线检测做准备
    const jianzhuModelData = successfulModels.find(
      (model) => model.modelInfo.name === "jianzhu"
    );
    if (jianzhuModelData) {
      jianzhuModel = jianzhuModelData.model;

      // 为建筑模型的所有网格添加标识，并收集所有mesh
      let meshCount = 0;
      const jianzhuMeshes = []; // 存储建筑模型的所有mesh
      jianzhuModel.traverse((child) => {
        if (child.isMesh) {
          child.userData.isJianzhu = true;
          jianzhuMeshes.push(child);
          meshCount++;
        }
      });

      console.log("🏗️ 建筑模型已准备就绪，支持射线检测，网格数量:", meshCount);

      // 将建筑模型的所有mesh存储到全局变量中，供外轮廓效果使用
      window.jianzhuMeshes = jianzhuMeshes;

      // 初始化外轮廓效果
      initOutlineEffect();

      // 添加鼠标事件监听器
      renderer.domElement.addEventListener("mousemove", onMouseMove);
      renderer.domElement.addEventListener("dblclick", onDoubleClick);

      console.log("🎯 鼠标事件监听器已添加");
    }

    // 根据配置计算相机位置
    const defaultDistance = cameraConfig.distance.default;
    const initialDistance = cameraConfig.distance.initial;
    const elevation = cameraConfig.position.elevation;
    const azimuth = cameraConfig.position.azimuth;

    // 计算目标相机位置（默认位置）
    const targetCameraPosition = calculateCameraPosition(
      center,
      radius,
      defaultDistance,
      elevation,
      azimuth
    );

    // 计算初始相机位置（从地球外开始）
    const initialCameraPosition = calculateCameraPosition(
      center,
      radius,
      initialDistance,
      elevation,
      azimuth
    );

    // 设置初始相机位置
    camera.position.copy(initialCameraPosition);
    camera.lookAt(center);

    // 设置控制器目标
    controls.target.copy(center);
    controls.update();

    // 更新相机参数，确保近远平面合适
    const maxDistance = radius * (cameraConfig.distance.max / 100);
    camera.near = maxDistance * cameraConfig.frustum.nearFactor;
    camera.far = maxDistance * cameraConfig.frustum.farFactor;
    camera.updateProjectionMatrix();

    // 更新控制器距离限制
    controls.minDistance = radius * (cameraConfig.distance.min / 100);
    controls.maxDistance = radius * (cameraConfig.distance.max / 100);

    console.log("🎯 Camera setup:", {
      中心点: center,
      半径: radius,
      初始位置: initialCameraPosition,
      目标位置: targetCameraPosition,
      距离倍数: `${defaultDistance}%`,
    });

    // 如果启用自动动画，开始相机拉近动画
    if (cameraConfig.animation.autoStart) {
      controls.enabled = false; // 动画期间禁用控制器
      setTimeout(() => {
        startCameraAnimation(
          initialCameraPosition,
          targetCameraPosition,
          center.clone(),
          center.clone(),
          cameraConfig.animation.duration
        );
      }, 500); // 延迟500ms开始动画，让模型加载完成
    } else {
      // 直接设置到目标位置
      camera.position.copy(targetCameraPosition);
      controls.update();
    }

    // 创建地面效果
    const core = { scene: scene };
    groundEffect = new BoxModel(core);

    // 计算地面位置
    const groundCenter = new THREE.Vector3(
      center.x,
      groupBox.min.y - 2, // 使用分组包围盒的最低点作为地面Y坐标
      center.z
    );

    // 初始化地面效果
    groundEffect.initModel(groundCenter, radius);

    // 添加一个简单的接收阴影的平面，确保阴影可见
    const shadowPlaneGeometry = new THREE.PlaneGeometry(
      radius * 10,
      radius * 10
    );
    const shadowPlaneMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      opacity: 0.3,
      transparent: true,
    });
    const shadowPlane = new THREE.Mesh(
      shadowPlaneGeometry,
      shadowPlaneMaterial
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(center.x, groupBox.min.y - 1.5, center.z);
    shadowPlane.receiveShadow = true;
    shadowPlane.renderOrder = 1; // 确保在BoxModel之上渲染
    scene.add(shadowPlane);

    console.log("🌫️ Added shadow plane at:", shadowPlane.position);

    // 根据配置决定是否自动生成植被
    if (vegetationConfig.enabled && vegetationConfig.generateOnLoad) {
      dixingModel = loadedModels.find(
        (model) => model.modelInfo.name === vegetationConfig.terrainModelName
      );
      if (dixingModel) {
        vegetationGroup = generateVegetationOnTerrain(dixingModel.model, scene);
      } else {
        console.warn(
          `⚠️ Terrain model "${vegetationConfig.terrainModelName}" not found for vegetation generation`
        );
      }
    } else {
      console.log("🌱 Vegetation auto-generation is disabled in config");
    }

    // 根据配置设置灯光
    // 环境光提供整体照明
    ambientLight = new THREE.AmbientLight(
      renderConfig.lighting.ambient.color,
      renderConfig.lighting.ambient.intensity
    );
    scene.add(ambientLight);

    // 主要平行光
    directionalLight = new THREE.DirectionalLight(
      renderConfig.lighting.directional.color,
      renderConfig.lighting.directional.intensity
    );
    const lightDistance = radius * renderConfig.lighting.directional.distance;

    // 使用配置的角度计算光线位置
    if (renderConfig.lighting.directional.angle) {
      const elevationRad =
        (renderConfig.lighting.directional.angle.elevation * Math.PI) / 180;
      const azimuthRad =
        (renderConfig.lighting.directional.angle.azimuth * Math.PI) / 180;

      const x =
        center.x +
        lightDistance * Math.cos(elevationRad) * Math.cos(azimuthRad);
      const y = center.y + lightDistance * Math.sin(elevationRad);
      const z =
        center.z +
        lightDistance * Math.cos(elevationRad) * Math.sin(azimuthRad);

      directionalLight.position.set(x, y, z);
    } else {
      // 默认位置
      directionalLight.position.set(
        center.x + lightDistance,
        center.y + lightDistance,
        center.z + lightDistance
      );
    }
    directionalLight.target.position.copy(center);

    // 根据配置启用阴影
    if (renderConfig.shadows.enabled) {
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = renderConfig.shadows.mapSize;
      directionalLight.shadow.mapSize.height = renderConfig.shadows.mapSize;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = lightDistance * 3;

      // 设置全局阴影强度
      if (renderConfig.shadows.intensity !== undefined) {
        directionalLight.shadow.intensity = renderConfig.shadows.intensity;
      }

      // 设置阴影偏移参数
      if (renderConfig.shadows.bias !== undefined) {
        directionalLight.shadow.bias = renderConfig.shadows.bias;
      }
      if (renderConfig.shadows.normalBias !== undefined) {
        directionalLight.shadow.normalBias = renderConfig.shadows.normalBias;
      }
      if (renderConfig.shadows.radius !== undefined) {
        directionalLight.shadow.radius = renderConfig.shadows.radius;
      }

      // 设置阴影相机的覆盖范围
      const shadowSize = radius * renderConfig.shadows.cameraSize;
      directionalLight.shadow.camera.left = -shadowSize;
      directionalLight.shadow.camera.right = shadowSize;
      directionalLight.shadow.camera.top = shadowSize;
      directionalLight.shadow.camera.bottom = -shadowSize;

      console.log("🌫️ Shadow settings applied:", {
        mapSize: renderConfig.shadows.mapSize,
        intensity: renderConfig.shadows.intensity,
        shadowSize: shadowSize,
        lightDistance: lightDistance,
      });
    }

    scene.add(directionalLight);
    scene.add(directionalLight.target);

    // 添加辅助填充光
    const fillLight = new THREE.DirectionalLight(
      renderConfig.lighting.fill.color,
      renderConfig.lighting.fill.intensity
    );
    fillLight.position.set(
      center.x - lightDistance * 0.5,
      center.y + lightDistance * 0.5,
      center.z + lightDistance * 0.5
    );
    scene.add(fillLight);

    console.log("🎯 All models setup completed:", {
      总模型数: successfulModels.length,
      总体中心: center,
      总体大小: size,
      相机位置: camera.position,
      控制器目标: controls.target,
      地面位置: groundCenter,
    });

    // 隐藏加载屏幕
    hideLoadingScreen();
  })
  .catch((error) => {
    console.error("❌ Failed to load models:", error);
    updateLoadingProgress("模型加载失败!");
    setTimeout(() => {
      hideLoadingScreen();
    }, 3000);
  });

// 创建灯光变量（将在模型加载后设置位置）
let ambientLight, directionalLight;

// 动画循环
function animate(time) {
  requestAnimationFrame(animate);

  // 更新相机动画
  updateCameraAnimation(time);

  // 如果相机动画未进行，才更新控制器
  if (!cameraAnimation.isAnimating) {
    controls.update();
  }

  // 更新地面效果动画
  if (groundEffect) {
    groundEffect.update(time * 0.001); // 使用requestAnimationFrame提供的高精度时间戳
  }

  // 更新所有动画混合器
  if (mixers.length > 0 && isAnimationPlaying) {
    mixers.forEach((mixer) => {
      mixer.update(0.016);
    });
  }

  // 应用风效果到植被
  if (vegetationGroup) {
    applyWindEffect(vegetationGroup, time * 0.001);
  }

  // 更新动态抗锯齿通道的时间uniform
  if (composer && composer.passes) {
    composer.passes.forEach((pass) => {
      if (
        pass.material &&
        pass.material.uniforms &&
        pass.material.uniforms["time"]
      ) {
        pass.material.uniforms["time"].value = time * 0.001;
      }
      if (
        pass.material &&
        pass.material.uniforms &&
        pass.material.uniforms["motionFactor"]
      ) {
        pass.material.uniforms["motionFactor"].value =
          Math.sin(time * 0.001) * 0.5 + 0.5; // 0到1之间的值
      }
    });
  }

  // 使用效果合成器渲染（如果已初始化）
  if (composer) {
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 4)); // 使用更高的像素比以获得更好的抗锯齿效果
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

// 添加动画控制按钮事件监听器
document.addEventListener("DOMContentLoaded", () => {
  const playButton = document.getElementById("playButton");
  const resetButton = document.getElementById("resetButton");
  const cameraAnimationButton = document.getElementById(
    "cameraAnimationButton"
  );
  const resetCameraButton = document.getElementById("resetCameraButton");

  // 播放动画按钮
  if (playButton) {
    playButton.addEventListener("click", () => {
      if (mixers.length > 0 && animationActions.length > 0) {
        if (!isAnimationPlaying) {
          // 开始播放所有动画
          animationActions.forEach((action) => {
            action.play();
          });
          isAnimationPlaying = true;
          console.log(
            `🎬 Started playing ${animationActions.length} animations`
          );
        } else {
          // 如果正在播放，则暂停/恢复
          animationActions.forEach((action) => {
            action.paused = !action.paused;
          });
          console.log("⏯️ Toggled animation pause/resume");
        }
      } else {
        console.log("❌ No animations available to play");
      }
    });
  }

  // 重置动画按钮
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      if (mixers.length > 0 && animationActions.length > 0) {
        // 停止并重置所有动画到初始状态
        animationActions.forEach((action) => {
          action.stop();
          action.reset();
        });
        isAnimationPlaying = false;
        console.log(`🔄 Reset ${animationActions.length} animations`);
      } else {
        console.log("❌ No animations available to reset");
      }
    });
  }

  // 相机拉近动画按钮
  if (cameraAnimationButton) {
    cameraAnimationButton.addEventListener("click", () => {
      if (loadedModels.length === 0) {
        console.log("❌ No models loaded for camera animation");
        return;
      }

      // 重新计算模型分组包围盒
      const groupBox = calculateGroupBoundingBox(modelsGroup);
      if (!groupBox) return;

      const center = groupBox.getCenter(new THREE.Vector3());
      const size = groupBox.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z);

      // 计算初始和目标位置
      const initialCameraPosition = calculateCameraPosition(
        center,
        radius,
        cameraConfig.distance.initial,
        cameraConfig.position.elevation,
        cameraConfig.position.azimuth
      );
      const targetCameraPosition = calculateCameraPosition(
        center,
        radius,
        cameraConfig.distance.default,
        cameraConfig.position.elevation,
        cameraConfig.position.azimuth
      );

      // 设置初始位置并开始动画
      camera.position.copy(initialCameraPosition);
      controls.target.copy(center);
      controls.enabled = false;

      startCameraAnimation(
        initialCameraPosition,
        targetCameraPosition,
        center.clone(),
        center.clone(),
        cameraConfig.animation.duration
      );

      console.log("🎬 Manual camera animation started");
    });
  }

  // 重置相机位置按钮
  if (resetCameraButton) {
    resetCameraButton.addEventListener("click", () => {
      if (loadedModels.length === 0) {
        console.log("❌ No models loaded for camera reset");
        return;
      }

      // 停止当前动画
      cameraAnimation.isAnimating = false;
      controls.enabled = true;

      // 重新计算模型分组包围盒
      const groupBox = calculateGroupBoundingBox(modelsGroup);
      if (!groupBox) return;

      const center = groupBox.getCenter(new THREE.Vector3());
      const size = groupBox.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z);

      // 计算默认相机位置
      const defaultCameraPosition = calculateCameraPosition(
        center,
        radius,
        cameraConfig.distance.default,
        cameraConfig.position.elevation,
        cameraConfig.position.azimuth
      );

      // 直接设置到默认位置
      camera.position.copy(defaultCameraPosition);
      camera.lookAt(center);
      controls.target.copy(center);
      controls.update();

      console.log("🔄 Camera position reset to default");
    });
  }

  // 生成植被按钮
  const generateVegetationButton = document.getElementById(
    "generateVegetationButton"
  );
  if (generateVegetationButton) {
    generateVegetationButton.addEventListener("click", () => {
      // 检查植被功能是否启用
      if (!vegetationConfig.enabled) {
        console.log("❌ Vegetation generation is disabled in config");
        alert("植被生成功能已在配置文件中禁用！");
        return;
      }

      // 查找配置中指定的地形模型
      const terrainModel = loadedModels.find(
        (model) => model.modelInfo.name === vegetationConfig.terrainModelName
      );

      if (!terrainModel) {
        console.log(
          `❌ No terrain model "${vegetationConfig.terrainModelName}" found for vegetation generation`
        );
        alert(
          `错误：没有找到地形模型 "${vegetationConfig.terrainModelName}"，无法生成植被！`
        );
        return;
      }

      // 禁用按钮防止重复点击
      generateVegetationButton.disabled = true;
      generateVegetationButton.textContent = "生成中...";

      try {
        // 先清除现有植被
        clearVegetation();

        // 生成新的植被
        vegetationGroup = generateVegetationOnTerrain(
          terrainModel.model,
          scene
        );
        console.log("🌱 Vegetation regenerated manually");

        // 更新按钮文本
        generateVegetationButton.textContent = "重新生成植被";
      } catch (error) {
        console.error("❌ Failed to generate vegetation:", error);
        alert("植被生成失败: " + error.message);
        generateVegetationButton.textContent = "生成植被";
      } finally {
        // 重新启用按钮
        generateVegetationButton.disabled = false;
      }
    });
  }

  // 清除植被按钮
  const clearVegetationButton = document.getElementById(
    "clearVegetationButton"
  );
  if (clearVegetationButton) {
    clearVegetationButton.addEventListener("click", () => {
      clearVegetation();

      // 更新生成按钮的文本
      if (generateVegetationButton) {
        generateVegetationButton.textContent = "生成植被";
      }
    });
  }
});

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);

  // 更新合成器大小
  if (composer) composer.setSize(width, height);

  // 更新外轮廓通道大小
  if (outlinePass) outlinePass.resolution.set(width, height);

  // 更新后处理通道的分辨率
  if (composer && composer.passes) {
    composer.passes.forEach((pass) => {
      if (
        pass.material &&
        pass.material.uniforms &&
        pass.material.uniforms["resolution"]
      ) {
        pass.material.uniforms["resolution"].value.set(width, height);
      }
    });
  }
});

animate();
