const fs = require("fs");
const path = require("path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");

// 读取models目录
const modelsDir = path.join(__dirname, "public", "models");
const outputFile = path.join(__dirname, "modelList.js");
const treePositionsFile = path.join(__dirname, "treePositions.json");

// 提取树坐标.glb模型中的树木坐标
async function extractTreePositions() {
  const treeCoordinatesModelPath = path.join(modelsDir, "树坐标.glb");

  if (!fs.existsSync(treeCoordinatesModelPath)) {
    console.warn("⚠️ 树坐标.glb 模型文件不存在，跳过坐标提取");
    return [];
  }

  try {
    console.log("🌳 开始提取 树坐标.glb 中的树木坐标...");

    // 创建 GLB 读取器
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

    // 读取GLB文件
    const document = await io.read(treeCoordinatesModelPath);
    const scene = document.getRoot().listScenes()[0];

    const treePositions = [];

    // 遍历场景中的所有节点
    scene.traverse((node) => {
      // 检查节点是否有网格（表示是一个可渲染对象）
      if (node.getMesh()) {
        const transform = node.getMatrix();
        const position = node.getTranslation();
        const rotation = node.getRotation();
        const scale = node.getScale();

        // 提取位置信息
        const treeData = {
          name: node.getName() || `tree_${treePositions.length}`,
          position: {
            x: position[0],
            y: position[1],
            z: position[2],
          },
          rotation: {
            x: rotation[0],
            y: rotation[1],
            z: rotation[2],
            w: rotation[3],
          },
          scale: {
            x: scale[0],
            y: scale[1],
            z: scale[2],
          },
          // 尝试从节点名称或其他属性推断树木类型
          type: inferTreeType(node.getName() || ""),
          index: treePositions.length,
        };

        treePositions.push(treeData);
      }
    });

    // 保存坐标数据到JSON文件
    const treeData = {
      extractedAt: new Date().toISOString(),
      sourceModel: "树坐标.glb",
      totalTrees: treePositions.length,
      positions: treePositions,
    };

    fs.writeFileSync(
      treePositionsFile,
      JSON.stringify(treeData, null, 2),
      "utf8"
    );

    console.log(`✅ 成功提取 ${treePositions.length} 棵树的坐标信息`);
    console.log(`📄 坐标数据已保存到: ${treePositionsFile}`);

    // 打印前几个坐标作为示例
    if (treePositions.length > 0) {
      console.log("📍 坐标示例:");
      treePositions.slice(0, 3).forEach((tree, index) => {
        console.log(
          `   ${index + 1}. ${tree.name}: (${tree.position.x.toFixed(
            2
          )}, ${tree.position.y.toFixed(2)}, ${tree.position.z.toFixed(2)})`
        );
      });
    }

    return treePositions;
  } catch (error) {
    console.error("❌ 提取树木坐标时出错:", error);
    return [];
  }
}

// 根据节点名称推断树木类型
function inferTreeType(nodeName) {
  const name = nodeName.toLowerCase();

  if (
    name.includes("bush") ||
    name.includes("灌木") ||
    name.includes("shrub")
  ) {
    return "bush";
  } else if (
    name.includes("conifer") ||
    name.includes("pine") ||
    name.includes("针叶") ||
    name.includes("松")
  ) {
    return "conifer";
  } else {
    return "deciduous"; // 默认为落叶树
  }
}

function generateModelList() {
  try {
    // 检查models目录是否存在
    if (!fs.existsSync(modelsDir)) {
      console.error("Models directory not found:", modelsDir);
      return;
    }

    // 读取目录中的文件
    const files = fs.readdirSync(modelsDir);

    // 过滤出.glb文件
    const glbFiles = files.filter(
      (file) => path.extname(file).toLowerCase() === ".glb"
    );

    // 生成模型信息
    const modelList = glbFiles.map((filename) => {
      const filePath = path.join(modelsDir, filename);
      const stats = fs.statSync(filePath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      return {
        name: path.basename(filename, ".glb"),
        filename: filename,
        path: `./models/${filename}`,
        size: `${sizeInMB}MB`,
        sizeBytes: stats.size,
        shadow: {
          castShadow: true,
          receiveShadow: false,
          shadowIntensity: 1.0,
        },
      };
    });

    // 生成JavaScript文件内容
    const jsContent = `// 自动生成的模型列表文件
// 生成时间: ${new Date().toISOString()}

export const modelList = ${JSON.stringify(modelList, null, 2)};

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
export const modelCount = ${modelList.length};
`;

    // 写入文件
    fs.writeFileSync(outputFile, jsContent, "utf8");

    console.log("✅ 模型列表生成成功!");
    console.log(`📁 找到 ${modelList.length} 个模型文件:`);
    modelList.forEach((model) => {
      console.log(`   - ${model.name} (${model.size})`);
    });
    console.log(`📄 列表文件已保存到: ${outputFile}`);
  } catch (error) {
    console.error("❌ 生成模型列表时出错:", error);
  }
}

// 主函数 - 同时生成模型列表和提取树木坐标
async function main() {
  console.log("🚀 开始生成模型列表和提取树木坐标...");

  // 生成模型列表
  generateModelList();

  // 提取树木坐标
  await extractTreePositions();

  console.log("✅ 所有任务完成!");
}

// 执行脚本
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ 执行过程中出错:", error);
    process.exit(1);
  });
}

module.exports = { generateModelList, extractTreePositions };
