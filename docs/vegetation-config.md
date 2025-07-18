# 植被生成配置说明

本项目支持通过配置文件自定义植被生成的各种参数。所有植被相关的配置都在 `config.js` 文件的 `vegetationConfig` 部分。

## 基本配置

### 启用/禁用植被功能

```javascript
export const vegetationConfig = {
  enabled: true, // 设为 false 可完全禁用植被生成功能
  generateOnLoad: true, // 设为 false 可禁用自动生成，只允许手动生成
  terrainModelName: "dixing", // 指定用于生成植被的地形模型名称
  // ...
};
```

## 植被类型配置

可以配置多种植被类型，每种类型有独立的参数：

```javascript
types: [
  {
    name: "deciduous", // 植被类型名称（落叶树）
    trunkLength: 4.0, // 树干高度
    trunkRadius: 0.2, // 树干半径
    branchLevels: 3, // 分支层级数
    leafColor: 0x4a7c3c, // 叶子颜色（16进制）
    trunkColor: 0x654321, // 树干颜色（16进制）
    count: 12, // 生成数量
    type: "deciduous", // 树木类型
    enabled: true, // 是否启用此类型
  },
  // 可以添加更多类型...
];
```

### 植被类型说明

- **deciduous**: 落叶树，通常较高，有分层的树冠
- **bush**: 灌木，较矮小，适合作为地面植被
- **conifer**: 针叶树，高大且呈锥形

## 生成区域配置

```javascript
generation: {
  heightOffset: 0.1, // 植被相对于地形的高度偏移
  minDistanceFromEdge: 0.1, // 距离地形边缘的最小距离（0-1之间的比例）
  maxDistanceFromEdge: 0.9, // 距离地形边缘的最大距离（0-1之间的比例）
  randomSeed: null, // 随机种子，null表示使用随机种子，设置数字可重现相同分布
},
```

## 外观配置

```javascript
appearance: {
  scaleRange: {
    min: 0.8, // 最小缩放比例
    max: 1.2, // 最大缩放比例
  },
  enableShadows: true, // 是否启用阴影
  enableRandomRotation: true, // 是否启用随机旋转
},
```

## 性能配置

```javascript
performance: {
  maxTotalVegetation: 100, // 最大植被总数
  enableLOD: false, // 是否启用LOD（详细级别）- 暂未实现
  cullingDistance: 100, // 剔除距离 - 暂未实现
},
```

## 使用示例

### 示例 1：创建密集的森林

```javascript
export const vegetationConfig = {
  enabled: true,
  generateOnLoad: true,
  terrainModelName: "dixing",
  types: [
    {
      name: "大树",
      trunkLength: 8.0,
      trunkRadius: 0.4,
      branchLevels: 4,
      leafColor: 0x2d5016,
      trunkColor: 0x4a3429,
      count: 30,
      type: "conifer",
      enabled: true,
    },
    {
      name: "小树",
      trunkLength: 4.0,
      trunkRadius: 0.2,
      branchLevels: 3,
      leafColor: 0x4a7c3c,
      trunkColor: 0x654321,
      count: 50,
      type: "deciduous",
      enabled: true,
    },
  ],
  generation: {
    heightOffset: 0.05,
    minDistanceFromEdge: 0.05,
    maxDistanceFromEdge: 0.95,
    randomSeed: 12345, // 固定种子，保证每次生成相同
  },
  appearance: {
    scaleRange: { min: 0.7, max: 1.5 },
    enableShadows: true,
    enableRandomRotation: true,
  },
  performance: {
    maxTotalVegetation: 200,
  },
};
```

### 示例 2：稀疏的草原

```javascript
export const vegetationConfig = {
  enabled: true,
  generateOnLoad: true,
  terrainModelName: "dixing",
  types: [
    {
      name: "灌木",
      trunkLength: 1.0,
      trunkRadius: 0.05,
      branchLevels: 2,
      leafColor: 0x6b8f47,
      trunkColor: 0x8b4513,
      count: 15,
      type: "bush",
      enabled: true,
    },
    {
      name: "零星大树",
      trunkLength: 6.0,
      trunkRadius: 0.3,
      branchLevels: 3,
      leafColor: 0x4a7c3c,
      trunkColor: 0x654321,
      count: 3,
      type: "deciduous",
      enabled: true,
    },
  ],
  generation: {
    heightOffset: 0.1,
    minDistanceFromEdge: 0.2,
    maxDistanceFromEdge: 0.8,
    randomSeed: null,
  },
  appearance: {
    scaleRange: { min: 0.9, max: 1.1 },
    enableShadows: true,
    enableRandomRotation: true,
  },
  performance: {
    maxTotalVegetation: 50,
  },
};
```

## 注意事项

1. **颜色值格式**：使用 16 进制颜色值，如 `0x4a7c3c`
2. **比例值**：`minDistanceFromEdge` 和 `maxDistanceFromEdge` 应为 0-1 之间的值
3. **性能考虑**：过多的植被会影响性能，建议根据设备性能调整 `maxTotalVegetation`
4. **地形模型**：确保 `terrainModelName` 对应的模型存在于项目中
5. **重新生成**：修改配置后，可以通过 UI 中的"重新生成植被"按钮应用新配置

## 故障排除

- 如果植被没有出现，检查 `enabled` 和 `generateOnLoad` 是否为 `true`
- 如果植被位置不理想，调整 `generation` 部分的参数
- 如果性能卡顿，减少 `count` 值或 `maxTotalVegetation` 值
- 如果植被颜色不满意，调整 `leafColor` 和 `trunkColor` 值
