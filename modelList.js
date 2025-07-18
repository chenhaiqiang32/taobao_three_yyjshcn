// 自动生成的模型列表文件
// 生成时间: 2025-07-17T02:09:35.761Z

export const modelList = [
  {
    "name": "che",
    "filename": "che.glb",
    "path": "./models/che.glb",
    "size": "42.66MB",
    "sizeBytes": 44734844,
    "shadow": {
      "castShadow": true,
      "receiveShadow": false,
      "shadowIntensity": 1
    }
  },
  {
    "name": "dixing",
    "filename": "dixing.glb",
    "path": "./models/dixing.glb",
    "size": "18.61MB",
    "sizeBytes": 19516200,
    "shadow": {
      "castShadow": true,
      "receiveShadow": false,
      "shadowIntensity": 1
    }
  },
  {
    "name": "jianzhu",
    "filename": "jianzhu.glb",
    "path": "./models/jianzhu.glb",
    "size": "11.47MB",
    "sizeBytes": 12026484,
    "shadow": {
      "castShadow": true,
      "receiveShadow": false,
      "shadowIntensity": 1
    }
  },
  {
    "name": "shu",
    "filename": "shu.glb",
    "path": "./models/shu.glb",
    "size": "4.55MB",
    "sizeBytes": 4767896,
    "shadow": {
      "castShadow": true,
      "receiveShadow": false,
      "shadowIntensity": 1
    }
  },
  {
    "name": "树坐标",
    "filename": "树坐标.glb",
    "path": "./models/树坐标.glb",
    "size": "0.14MB",
    "sizeBytes": 143352,
    "shadow": {
      "castShadow": true,
      "receiveShadow": false,
      "shadowIntensity": 1
    }
  }
];

// 获取所有模型名称
export function getModelNames() {
  return modelList.map(model => model.name);
}

// 根据名称获取模型信息
export function getModelByName(name) {
  return modelList.find(model => model.name === name);
}

// 获取默认模型（第一个）
export function getDefaultModel() {
  return modelList.length > 0 ? modelList[0] : null;
}

// 获取模型的阴影配置
export function getModelShadowConfig(name) {
  const model = getModelByName(name);
  return model ? model.shadow : null;
}

// 获取所有模型的阴影配置
export function getAllModelShadowConfigs() {
  return modelList.map(model => ({
    name: model.name,
    shadow: model.shadow
  }));
}

// 模型总数
export const modelCount = 5;
