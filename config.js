// 相机和场景配置文件
export const cameraConfig = {
  // 相机距离配置（相对于包围盒半径的百分比）
  distance: {
    default: 80, // 默认相机距离（半径的250%）
    min: 10, // 最小距离（半径的50%）
    max: 500, // 最大距离（半径的500%）
    initial: 2000, // 初始距离（从地球外开始，半径的2000%）
  },

  // 相机位置角度配置
  position: {
    elevation: 30, // 仰角（度）
    azimuth: 90, // 方位角（度）
  },

  // 动画配置
  animation: {
    duration: 2000, // 拉近动画持续时间（毫秒）
    easing: "easeOutCubic", // 缓动函数类型
    autoStart: true, // 是否自动开始动画
  },

  // 控制器配置
  controls: {
    enableDamping: true,
    dampingFactor: 0.05,
    enablePan: true,
    enableZoom: true,
    enableRotate: true,
    maxPolarAngle: Math.PI, // 最大极角
    minDistance: 0.1, // 最小缩放距离 - 降低以允许更近距离观察
    maxDistance: 1000, // 最大缩放距离
  },

  // 近远平面配置
  frustum: {
    nearFactor: 0.001, // 近平面因子（相对于距离）- 降低值以防止模型被裁剪
    farFactor: 100, // 远平面因子（相对于距离）
  },
};

// 渲染配置
export const renderConfig = {
  shadows: {
    enabled: true,
    mapSize: 8096, // 提高阴影贴图质量
    cameraSize: 2.0, // 增大阴影相机范围
    intensity: 0.5, // 降低全局阴影强度让阴影更明显
    bias: -0.0001, // 阴影偏移，防止阴影失真
    normalBias: 0.01, // 法线偏移
    radius: 4, // 阴影模糊半径
    modelDefaults: {
      castShadow: true, // 默认投射阴影
      receiveShadow: false, // 默认不接受阴影
      shadowIntensity: 1.0, // 默认阴影强度
    },
  },

  lighting: {
    ambient: {
      intensity: 0.6, // 降低环境光，让阴影更明显
      color: 0xffffff,
    },
    directional: {
      intensity: 3.0, // 增强主光源
      color: 0xffffff,
      distance: 2, // 灯光距离因子（相对于半径）
      angle: {
        elevation: 45, // 光线仰角（度）
        azimuth: 135, // 光线方位角（度）
      },
    },
    fill: {
      intensity: 0.2, // 降低填充光
      color: 0xffffff,
    },
  },

  environment: {
    intensity: 2.0, // 环境贴图强度
  },
};

// 植被生成配置
export const vegetationConfig = {
  enabled: true, // 是否启用植被生成
  generateOnLoad: true, // 模型加载完成后是否自动生成植被
  terrainModelName: "dixing", // 用于生成植被的地形模型名称

  // 生成模式配置
  generationMode: "coordinates", // "random"(随机生成) 或 "coordinates"(基于坐标数据)
  coordinatesFile: "./treePositions.json", // 坐标数据文件路径

  // 植被类型配置 - 只保留灌木（使用简单几何体）
  types: [
    {
      name: "small_bush", // 小型灌木
      trunkLength: 0.15,
      trunkRadius: 0.02,
      leafColor: 0xffffff,
      trunkColor: 0x8b4513,
      count: 15,
      type: "bush",
      enabled: true,
      windEffect: {
        enabled: true,
        intensity: 0.3,
        frequency: 3,
      },
    },
    {
      name: "medium_bush", // 中型灌木
      trunkLength: 0.2,
      trunkRadius: 0.03,
      leafColor: 0xffffff,
      trunkColor: 0x654321,
      count: 10,
      type: "bush",
      enabled: true,
      windEffect: {
        enabled: true,
        intensity: 0.4,
        frequency: 2.5,
      },
    },
    {
      name: "large_bush", // 大型灌木
      trunkLength: 0.25,
      trunkRadius: 0.04,
      leafColor: 0xffffff,
      trunkColor: 0x5d4e37,
      count: 8,
      type: "bush",
      enabled: true,
      windEffect: {
        enabled: true,
        intensity: 0.5,
        frequency: 2,
      },
    },
  ],

  // 生成区域配置
  generation: {
    heightOffset: 0.1, // 植被相对于地形的高度偏移
    minDistanceFromEdge: 0.1, // 距离地形边缘的最小距离（相对于地形大小）
    maxDistanceFromEdge: 0.9, // 距离地形边缘的最大距离（相对于地形大小）
    randomSeed: null, // 随机种子，null表示使用随机种子
  },

  // 植被外观配置
  appearance: {
    scaleRange: {
      min: 0.5,
      max: 1.0,
    },
    enableShadows: true, // 是否启用阴影
    enableRandomRotation: true, // 是否启用随机旋转
  },

  // 性能配置
  performance: {
    maxTotalVegetation: 100, // 最大植被总数
    enableLOD: false, // 是否启用LOD（详细级别）
    cullingDistance: 100, // 剔除距离
  },
};

// 缓动函数
export const easingFunctions = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => --t * t * t + 1,
  easeInOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuart: (t) => t * t * t * t,
  easeOutQuart: (t) => 1 - --t * t * t * t,
  easeInOutQuart: (t) =>
    t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t,
};
