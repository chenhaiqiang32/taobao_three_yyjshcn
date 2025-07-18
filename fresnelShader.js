export const fresnelVertexShader = `
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const fresnelFragmentShader = `
uniform vec3 fresnelColor;
uniform float fresnelPower;
uniform float fresnelIntensity;

varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    
    // 计算菲涅尔效果
    float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), fresnelPower);
    fresnel = fresnel * fresnelIntensity;
    
    // 基础颜色（更亮的灰色）
    vec3 baseColor = vec3(0.9, 0.9, 0.9);
    
    // 混合基础颜色和菲涅尔颜色，保持基础颜色更明显
    vec3 finalColor = mix(baseColor, fresnelColor, fresnel * 0.5);
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;
