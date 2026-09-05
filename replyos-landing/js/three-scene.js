// Three.js 3D Smoothie Visualizations

function createSmoothieBlob(containerId, color1, color2, color3) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.offsetWidth / container.offsetHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Create organic blob geometry
    const geometry = new THREE.IcosahedronGeometry(2, 64);
    const positions = geometry.attributes.position;
    const originalPositions = positions.array.slice();
    
    // Custom shader material for smoothie look
    const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color1),
        emissive: new THREE.Color(color2),
        emissiveIntensity: 0.2,
        metalness: 0.1,
        roughness: 0.2,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Add inner glow sphere
    const glowGeometry = new THREE.IcosahedronGeometry(1.5, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color3),
        transparent: true,
        opacity: 0.15
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glowMesh);

    // Floating particles
    const particleCount = 50;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount * 3; i++) {
        particlePositions[i] = (Math.random() - 0.5) * 8;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
        color: new THREE.Color(color1),
        size: 0.05,
        transparent: true,
        opacity: 0.6
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(color2, 2, 10);
    pointLight.position.set(-3, 2, 3);
    scene.add(pointLight);

    camera.position.z = 5;

    // Animation
    let time = 0;
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const delta = clock.getDelta();
        time += delta;

        // Morph the blob
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = originalPositions[i * 3];
            const y = originalPositions[i * 3 + 1];
            const z = originalPositions[i * 3 + 2];
            
            const noise = Math.sin(x * 2 + time) * Math.cos(y * 2 + time * 0.8) * Math.sin(z * 2 + time * 1.2);
            const distortion = 1 + noise * 0.15;
            
            positions.setXYZ(i, x * distortion, y * distortion, z * distortion);
        }
        positions.needsUpdate = true;
        geometry.computeVertexNormals();

        // Rotate
        mesh.rotation.y += delta * 0.2;
        mesh.rotation.x += delta * 0.1;
        glowMesh.rotation.y -= delta * 0.15;
        
        // Float particles
        const pPositions = particles.geometry.attributes.position;
        for (let i = 0; i < particleCount; i++) {
            const y = pPositions.getY(i);
            pPositions.setY(i, y + Math.sin(time + i) * 0.002);
        }
        pPositions.needsUpdate = true;
        particles.rotation.y += delta * 0.05;

        renderer.render(scene, camera);
    }

    animate();

    // Resize handler
    window.addEventListener('resize', () => {
        if (!container.offsetWidth || !container.offsetHeight) return;
        camera.aspect = container.offsetWidth / container.offsetHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.offsetWidth, container.offsetHeight);
    });

    // Mouse interaction
    let mouseX = 0, mouseY = 0;
    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        
        if (typeof gsap !== 'undefined') {
            gsap.to(mesh.rotation, {
                x: mouseY * 0.3,
                y: mouseX * 0.3,
                duration: 1,
                ease: 'power2.out'
            });
        }
    });
}

// Initialize scenes
document.addEventListener('DOMContentLoaded', () => {
    // Hero scene - blue/purple smoothie blob
    createSmoothieBlob('hero-canvas-container', '#4F6AF6', '#8B5CF6', '#06B6D4');
    
    // Viz section scene - multi-color
    createSmoothieBlob('viz-canvas-container', '#EC4899', '#8B5CF6', '#4F6AF6');
    
    // CTA scene - cyan/blue
    createSmoothieBlob('cta-canvas-container', '#06B6D4', '#4F6AF6', '#8B5CF6');
});
