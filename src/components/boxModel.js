import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import MemoryManager from "./memoryManager";
class BoxModel {
  constructor(core) {
    this.core = core;
    this.elapsedTime = { value: 0 };
    this.boxModel = [];
    this.position = null;
    this.lightIndex = 0;
    this.lastRenderTime = 0; // 上次计算时间
    this.newInter = null;
    this.Lines = [];
    this.time = 0;
    this.images = [
      "./shader/grid3.png",
      "./shader/icon_20220311102510983_318887.png",
      // "./shader/icon_20210625174703331_294105.png",
      // "./shader/icon_20210625174822322_937383.png",
      // "./shader/icon_20210625175116741_958937.png",
      // "./shader/icon_20210625175205515_73731.png",
      // "/shader/icon_20210407163008223_378401.png",
      // "/shader/icon_20210418125256801_956034.png",

      // "/地板面02.png",
    ];
    this.imagesObj = [
      {
        data: "https://prs-file.oss-cn-beijing.aliyuncs.com/product/resource/7582/16544/static/ground/icon_20220311102510983_318887.png",
        t: "https://prs-file.oss-cn-beijing.aliyuncs.com/product/resource/7582/16544/static/ground/systemIcons/光1.png",
        r: 0.26,
        i: 1,
        n: "rgba(54,215,255,1)",
        o: 6.4,
        s: 0.5,
        a: "rgba(18,208,255,1)",
        l: false,
        h: "flow",
        c: 5,
        u: 5,
      },
      {
        data: "https://prs-file.oss-cn-beijing.aliyuncs.com/product/resource/7582/16544/static/ground/icon_20211208112842284_782756.png",
        t: "https://prs-file.oss-cn-beijing.aliyuncs.com/product/resource/7582/16544/static/ground/systemIcons/光1.png",
        r: 0.26,
        i: 1,
        n: "rgba(54,215,255,1)",
        o: 6.4,
        s: 0.5,
        a: "rgba(18,208,255,1)",
        l: false,
        h: "flow",
        c: 5,
        u: 5,
      },
    ];
  }
  initModel(center, radius) {
    this.position = center;
    if (this.boxModel.length) {
      this.dispose();
    }
    for (let i = 0; i < this.images.length; i++) {
      var t = this._createMaterial(
        this.images[i],
        "./shader/光1.png",
        2.0, // 增加基础透明度
        1,
        "rgba(0.2, 0.8, 1.0, 1)", // 更鲜明的蓝色
        8.0, // 增加发光因子
        1.2, // 增加动画速度
        "rgba(0, 1.0, 1.0, 1)", // 更亮的青色流光
        false,
        "flow",
        5,
        5,
        100 // 减少重复因子，让网格更大更清晰
      );
      var r = new THREE.PlaneGeometry(radius * 20, radius * 20);
      let boxModel = new THREE.Mesh(r, t);
      boxModel.renderOrder = -1;
      boxModel.rotation.x = -Math.PI / 2;
      boxModel.position.set(this.position.x, this.position.y, this.position.z);

      // 设置地面接收阴影
      boxModel.receiveShadow = true;

      this.boxModel.push(boxModel);
      this.core.scene.add(boxModel);
    }
  }
  _createMaterial(e, t, r, i, n, o, s, a, l, h, c, u, repeatFactor) {
    var p = new THREE.TextureLoader(),
      d = null,
      g = null;
    l ||
      (((d = p.load(e)).wrapS = d.wrapT = THREE.RepeatWrapping),
      ((g = p.load(t)).wrapS = g.wrapT = THREE.RepeatWrapping));
    var f = {
        map: {
          value: d,
        },
        time: this.elapsedTime,
        opacity: {
          value: 1.5, // 增加整体不透明度
        },
        alpha: {
          value: r,
        },
        repeatFactor: {
          value: repeatFactor,
        },
        maskMap: {
          value: g,
        },
        color: {
          value: new THREE.Color(n),
        },
        glowFactor: {
          value: o,
        },
        speed: {
          value: s,
        },
        flowColor: {
          value: new THREE.Color(a),
        },
      },
      m = `varying vec2 vUv;
                void main() {
                  vUv = uv;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
                }`,
      v = `
            varying vec2 vUv;
            uniform sampler2D map;
            uniform sampler2D maskMap;
            uniform float time;
            uniform float opacity;
            uniform float repeatFactor;
            uniform float alpha;
            uniform vec3 color;
            uniform vec3 flowColor;
            uniform float glowFactor;
            uniform float speed;
            void main() {
            //   float repeatFactor = 48.0;
              vec2 mapUv = vUv * repeatFactor;
              float t = mod(time / 5. * speed, 1.);
              vec2 uv = abs((vUv - vec2(0.5)) * 2.0);
              float dis = length(uv);
              float r = t - dis;
              vec4 col = texture2D(map, mapUv);
              vec3 finalCol;
              vec4 mask = texture2D(maskMap, vec2(0.5, r));

              // 增强流光效果
              float glowIntensity = clamp(0., 1., mask.a * glowFactor);
              finalCol = mix(color, flowColor, glowIntensity);
              
              // 增强整体亮度和对比度
              finalCol *= 1.5;
              
              // 改进透明度计算，让效果更明显
              float finalAlpha = (alpha + glowIntensity * 2.0) * col.a * (1.2 - dis * 0.8) * opacity;
              gl_FragColor = vec4(finalCol.rgb, clamp(0., 1., finalAlpha));
            }
          `;
    let y = new THREE.ShaderMaterial({
      uniforms: f,
      vertexShader: m,
      fragmentShader: v,
      transparent: true,
      blending: THREE.AdditiveBlending, // 使用加法混合增强发光效果
      depthWrite: false, // 禁用深度写入避免遮挡问题
      side: THREE.DoubleSide, // 双面渲染确保可见性
    });
    return (y.roughness = l ? 0.1 : 1), y;
  }
  dispose() {
    if (this.boxModel.length) {
      this.boxModel.forEach((element) => {
        MemoryManager.dispose(element);
      });
    }
  }
  update(value) {
    const relTime = value - this.lastRenderTime;
    this.elapsedTime.value = value;
    this.lastRenderTime = value; // 更新上次渲染时间
  }
}

export default BoxModel;
