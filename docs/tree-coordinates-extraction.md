# 从 GLB 模型提取树木坐标并生成程序化植被

本项目现在支持从现有的 3D 模型中提取树木坐标信息，然后使用这些坐标数据生成程序化的 ez-tree。这种方法结合了设计师的布局意图和程序化生成的灵活性。

## 功能概述

1. **坐标提取**: 从 `shu.glb` 模型中提取每棵树的位置、旋转和缩放信息
2. **数据存储**: 将提取的坐标保存到 JSON 文件中
3. **程序化生成**: 根据坐标数据生成 ez-tree，保持原有的空间布局
4. **配置化管理**: 通过配置文件灵活控制生成模式和参数

## 使用方法

### 步骤 1: 提取坐标数据

运行坐标提取脚本：

```bash
node generateModelList.cjs
```

此脚本将：

- 生成模型列表（`modelList.js`）
- 从 `public/models/shu.glb` 提取树木坐标
- 保存坐标数据到 `treePositions.json`

### 步骤 2: 配置生成模式

在 `config.js` 中设置植被生成模式：

```javascript
export const vegetationConfig = {
  enabled: true,
  generateOnLoad: true,
  terrainModelName: "dixing",

  // 设置为坐标模式
  generationMode: "coordinates", // "random" 或 "coordinates"
  coordinatesFile: "./treePositions.json",

  // 其他配置...
};
```

### 步骤 3: 启动项目

```bash
npm run dev
```

项目加载后，系统会：

1. 读取 `treePositions.json` 文件
2. 在原有坐标位置生成 ez-tree
3. 使用配置的树木类型和外观参数

## 坐标数据格式

提取的坐标数据保存在 `treePositions.json` 中：

```json
{
  "extractedAt": "2025-07-15T07:35:30.191Z",
  "sourceModel": "shu.glb",
  "totalTrees": 1,
  "positions": [
    {
      "name": "shu",
      "position": {
        "x": 129.2527,
        "y": -0.5727495,
        "z": -52.4523163
      },
      "rotation": {
        "x": 0,
        "y": 0,
        "z": 0,
        "w": 1
      },
      "scale": {
        "x": 0.839461863,
        "y": 0.814564764,
        "z": 0.839461863
      },
      "type": "deciduous",
      "index": 0
    }
  ]
}
```

## 配置选项

### 生成模式

```javascript
// 坐标模式：使用提取的坐标数据
generationMode: "coordinates";

// 随机模式：在地形上随机生成
generationMode: "random";
```

### 树木类型推断

系统会根据模型节点名称自动推断树木类型：

- 包含 "bush", "灌木", "shrub" → `bush`
- 包含 "conifer", "pine", "针叶", "松" → `conifer`
- 其他 → `deciduous` (默认)

### 坐标数据优先级

1. **位置**: 优先使用原始坐标，保持设计意图
2. **旋转**:
   - 如果启用随机旋转，忽略原始旋转
   - 否则使用原始旋转数据
3. **缩放**:
   - 如果原始模型有缩放数据，使用该数据
   - 否则使用配置的缩放范围随机生成

## 技术实现

### 依赖包

```json
{
  "@gltf-transform/core": "^4.x.x",
  "@gltf-transform/extensions": "^4.x.x"
}
```

### 核心函数

1. **extractTreePositions()**: 提取坐标数据
2. **generateVegetationFromCoordinates()**: 基于坐标生成植被
3. **generateVegetationRandomly()**: 随机生成植被（保留向后兼容）
4. **getTreeConfigByType()**: 根据类型获取树木配置

## 优势特点

### 设计保真度

- 保持原有的景观设计布局
- 精确的位置和空间关系
- 可重现的结果

### 灵活性

- 支持两种生成模式切换
- 可配置的树木外观参数
- 运行时重新生成

### 性能优化

- 按需加载坐标数据
- 支持最大植被数量限制
- 优雅降级（坐标文件缺失时回退到随机模式）

## 错误处理

系统具有完善的错误处理机制：

1. **文件缺失**: 自动回退到随机生成模式
2. **坐标数据损坏**: 跳过无效数据，继续处理
3. **树木生成失败**: 使用备用树木（几何体）
4. **网络错误**: 显示详细错误信息

## 扩展可能

### 多模型支持

可以扩展为支持多个 GLB 模型的坐标提取：

```javascript
const modelsToExtract = ["shu.glb", "flowers.glb", "rocks.glb"];
```

### 高级类型推断

可以基于更多属性推断植被类型：

```javascript
function inferTreeType(node) {
  const material = node.getMesh()?.getMaterial();
  const geometry = node.getMesh()?.getPrimitive();
  // 基于材质颜色、几何体大小等推断类型
}
```

### 分层坐标系统

支持不同高度层的植被分布：

```javascript
{
  "layers": {
    "ground": [...],     // 地面植被
    "mid": [...],        // 中层植被
    "canopy": [...]      // 树冠层
  }
}
```

## 故障排除

### 常见问题

1. **坐标数据为空**

   - 检查 `shu.glb` 文件是否存在
   - 确认模型中包含可渲染的网格对象

2. **植被位置异常**

   - 检查坐标数据的坐标系是否与场景一致
   - 调整 `heightOffset` 配置

3. **性能问题**

   - 减少 `maxTotalVegetation` 值
   - 启用 LOD（待实现）

4. **类型匹配失败**
   - 在配置中添加对应的树木类型
   - 检查 `inferTreeType` 函数的推断逻辑
