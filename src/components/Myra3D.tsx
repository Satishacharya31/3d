import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Sliders, ChevronDown, ChevronUp } from 'lucide-react';

function ChestFramer() {
  const { camera, scene } = useThree();
  const [target, setTarget] = useState<[number, number, number]>([0, 1.4, 0]);

  useEffect(() => {
    // Wait a brief moment for the model to be fully parsed and added to the scene
    const timeout = setTimeout(() => {
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // Calculate chest position (roughly 25% from the center towards the top)
      const chestY = center.y + size.y * 0.25;
      
      // Calculate distance to frame the upper body nicely
      // The smaller the multiplier, the closer the camera
      const distance = center.z + size.y * 0.8;
      
      // Position the camera
      camera.position.set(center.x, chestY, distance);
      
      // Update camera
      camera.updateProjectionMatrix();

      // Update target
      setTarget([center.x, chestY, center.z]);
    }, 100);
    
    return () => clearTimeout(timeout);
  }, [camera, scene]);

  return <OrbitControls target={target} enableZoom={false} enablePan={false} enableRotate={false} makeDefault />;
}

interface ModelProps {
  isSpeaking: boolean;
  isThinking?: boolean;
  isListening?: boolean;
  onHeadBoneLoaded?: (bone: THREE.Object3D) => void;
}

function Model({ isSpeaking, isThinking, isListening, onHeadBoneLoaded }: ModelProps) {
  const { scene, animations } = useGLTF('/myra.glb');
  const group = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Object3D | null>(null);
  const rightArmRef = useRef<THREE.Object3D | null>(null);
  const leftForeArmRef = useRef<THREE.Object3D | null>(null);
  const rightForeArmRef = useRef<THREE.Object3D | null>(null);
  const headRef = useRef<THREE.Object3D | null>(null);
  const jawRef = useRef<THREE.Object3D | null>(null);
  const spineRef = useRef<THREE.Object3D | null>(null);
  const neckRef = useRef<THREE.Object3D | null>(null);
  
  const [hairBones, setHairBones] = useState<{ bone: THREE.Object3D, initX: number, initZ: number }[]>([]);
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    const tempHair: { bone: THREE.Object3D, initX: number, initZ: number }[] = [];
    
    scene.traverse(child => {
      const name = child.name.toLowerCase();
      const isBone = (child as any).isBone || child.type === 'Bone';
      if (!isBone) return;

      const isLeft = name.includes('left') || name.includes('_l_') || name.startsWith('l_') || name.includes('bip_l_');
      const isRight = name.includes('right') || name.includes('_r_') || name.startsWith('r_') || name.includes('bip_r_');
      
      const isUpperArm = (name.includes('arm') || name.includes('shoulder')) && 
                         !name.includes('fore') && !name.includes('lower') && 
                         !name.includes('hand') && !name.includes('clavicle');
      
      const isForeArm = name.includes('forearm') || name.includes('fore_arm') || 
                        name.includes('lowerarm') || name.includes('lower_arm') || 
                        name.includes('elbow') || (name.includes('arm') && name.includes('lower'));

      if (isLeft && isUpperArm) leftArmRef.current = child;
      if (isRight && isUpperArm) rightArmRef.current = child;
      if (isLeft && isForeArm) leftForeArmRef.current = child;
      if (isRight && isForeArm) rightForeArmRef.current = child;
      if (name.includes('head') && !name.includes('hair')) headRef.current = child;
      if (name.includes('jaw') || name.includes('mouth')) jawRef.current = child;
      if (name.includes('neck')) neckRef.current = child;
      if (name.includes('spine') || name.includes('chest') || name.includes('torso')) spineRef.current = child;
      
      if (name.includes('hair') || name.includes('fringe') || name.includes('strand') || name.includes('tail') || name.includes('jiggle') || name.includes('ahoge')) {
        tempHair.push({ bone: child, initX: child.rotation.x, initZ: child.rotation.z });
      }
    });

    setHairBones(tempHair);
  }, [scene]);

  useEffect(() => {
    if (headRef.current && onHeadBoneLoaded) {
      onHeadBoneLoaded(headRef.current);
    }
  }, [headRef.current, onHeadBoneLoaded]);

  useEffect(() => {
    if (names.length === 0) return;
    
    let talkingAnim = names.find(n => n.toLowerCase().includes('talk') || n.toLowerCase().includes('speak'));
    let thinkingAnim = names.find(n => n.toLowerCase().includes('think'));
    let idleAnim = names.find(n => n.toLowerCase().includes('idle'));
    
    if (!idleAnim) idleAnim = names[0];
    if (!talkingAnim) talkingAnim = idleAnim;
    if (!thinkingAnim) thinkingAnim = idleAnim;

    const currentAnim = isSpeaking ? talkingAnim : (isThinking ? thinkingAnim : idleAnim);
    
    if (currentAnim && actions[currentAnim]) {
      actions[currentAnim]?.reset().fadeIn(0.5).play();
      return () => {
        actions[currentAnim]?.fadeOut(0.5);
      };
    }
  }, [isSpeaking, isThinking, actions, names]);

  useFrame((state) => {
    if (group.current) {
      const time = state.clock.elapsedTime;

      // Gentle flowing hair waving (Live indicator)
      hairBones.forEach(({ bone, initX, initZ }, index) => {
         const phase = index * 0.45;
         const waveX = Math.sin(time * 1.5 + phase) * 0.05;
         const waveZ = Math.cos(time * 1.2 + phase) * 0.04;
         bone.rotation.x = initX + waveX;
         bone.rotation.z = initZ + waveZ;
      });

      if (isSpeaking) {
         const gestureCycle = (time * 0.6) % 3;
         
         let lArmZ = -1.1; 
         let lArmX = -0.25;
         let lArmY = 0.15;
         let lForeX = 1.25;
         let lForeY = -0.3;

         let rArmZ = 1.1;
         let rArmX = -0.25;
         let rArmY = -0.15;
         let rForeX = 1.25;
         let rForeY = 0.3;

         if (gestureCycle < 1.0) {
           const wave = Math.sin(time * 5.0) * 0.25;
           lArmZ = -0.65;
           lArmX = -0.85 + wave;
           lArmY = 0.35;
           lForeX = 1.35;
           lForeY = -0.4;

           rArmZ = 0.65;
           rArmX = -0.85 + wave * 0.8;
           rArmY = -0.35;
           rForeX = 1.35;
           rForeY = 0.4;
         } else if (gestureCycle < 2.0) {
           const wave = Math.sin(time * 6.0) * 0.35;
           lArmZ = -0.35;
           lArmX = -1.2 + wave;
           lArmY = 0.45;
           lForeX = 1.55;
           lForeY = -0.55;

           rArmZ = 1.3;
           rArmX = -0.15;
           rArmY = -0.1;
           rForeX = 0.25;
           rForeY = 0.05;
         } else {
           const wave = Math.sin(time * 6.0) * 0.35;
           lArmZ = -1.3;
           lArmX = -0.15;
           lArmY = 0.1;
           lForeX = 0.25;
           lForeY = -0.05;

           rArmZ = 0.35;
           rArmX = -1.2 + wave;
           rArmY = -0.45;
           rForeX = 1.55;
           rForeY = 0.55;
         }

         if (leftArmRef.current) {
           leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, lArmZ, 0.09);
           leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, lArmX, 0.09);
           leftArmRef.current.rotation.y = THREE.MathUtils.lerp(leftArmRef.current.rotation.y, lArmY, 0.09);
         }
         if (rightArmRef.current) {
           rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, rArmZ, 0.09);
           rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, rArmX, 0.09);
           rightArmRef.current.rotation.y = THREE.MathUtils.lerp(rightArmRef.current.rotation.y, rArmY, 0.09);
         }
         if (leftForeArmRef.current) {
           leftForeArmRef.current.rotation.z = THREE.MathUtils.lerp(leftForeArmRef.current.rotation.z, 0, 0.09);
           leftForeArmRef.current.rotation.x = THREE.MathUtils.lerp(leftForeArmRef.current.rotation.x, lForeX, 0.09);
           leftForeArmRef.current.rotation.y = THREE.MathUtils.lerp(leftForeArmRef.current.rotation.y, lForeY, 0.09);
         }
         if (rightForeArmRef.current) {
           rightForeArmRef.current.rotation.z = THREE.MathUtils.lerp(rightForeArmRef.current.rotation.z, 0, 0.09);
           rightForeArmRef.current.rotation.x = THREE.MathUtils.lerp(rightForeArmRef.current.rotation.x, rForeX, 0.09);
           rightForeArmRef.current.rotation.y = THREE.MathUtils.lerp(rightForeArmRef.current.rotation.y, rForeY, 0.09);
         }

         const spineBob = Math.sin(time * 2.2) * 0.012;
         const spineSwayX = Math.sin(time * 1.5) * 0.035;
         const spineSwayY = Math.cos(time * 1.1) * 0.025;

         if (spineRef.current) {
           spineRef.current.rotation.x = THREE.MathUtils.lerp(spineRef.current.rotation.x, 0.02 + spineSwayX, 0.09);
           spineRef.current.rotation.y = THREE.MathUtils.lerp(spineRef.current.rotation.y, spineSwayY, 0.09);
           spineRef.current.position.y = THREE.MathUtils.lerp(spineRef.current.position.y, spineBob, 0.09);
         }

         if (neckRef.current) {
           neckRef.current.rotation.x = THREE.MathUtils.lerp(neckRef.current.rotation.x, 0.01 + Math.sin(time * 2.8) * 0.02, 0.09);
           neckRef.current.rotation.y = THREE.MathUtils.lerp(neckRef.current.rotation.y, Math.cos(time * 1.4) * 0.02, 0.09);
         }

         if (headRef.current) {
           const headNod = Math.sin(time * 3.2) * 0.055;
           const headTilt = Math.cos(time * 1.6) * 0.06;
           const headTurn = Math.sin(time * 1.0) * 0.09;

           headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, 0.04 + headNod, 0.09);
           headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, headTurn, 0.09);
           headRef.current.rotation.z = THREE.MathUtils.lerp(headRef.current.rotation.z, headTilt, 0.09);
         }
      } else if (isListening) {
         const listenSpineX = 0.08;
         const listenSpineY = 0.04; 
         const listenHeadX = 0.08;
         const listenHeadY = 0.45; 
         const listenHeadZ = -0.16;

         if (spineRef.current) {
           spineRef.current.rotation.x = THREE.MathUtils.lerp(spineRef.current.rotation.x, listenSpineX, 0.08);
           spineRef.current.rotation.y = THREE.MathUtils.lerp(spineRef.current.rotation.y, listenSpineY, 0.08);
           spineRef.current.rotation.z = THREE.MathUtils.lerp(spineRef.current.rotation.z, 0, 0.08);
         }

         if (neckRef.current) {
           neckRef.current.rotation.x = THREE.MathUtils.lerp(neckRef.current.rotation.x, 0.02, 0.08);
           neckRef.current.rotation.y = THREE.MathUtils.lerp(neckRef.current.rotation.y, 0.05, 0.08);
         }

         if (headRef.current) {
           const swayX = Math.sin(time * 1.2) * 0.01;
           const swayY = Math.cos(time * 0.9) * 0.015;
           const swayZ = Math.sin(time * 1.0) * 0.01;

           headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, listenHeadX + swayX, 0.08);
           headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, listenHeadY + swayY, 0.08);
           headRef.current.rotation.z = THREE.MathUtils.lerp(headRef.current.rotation.z, listenHeadZ + swayZ, 0.08);
         }

         let lArmZ = -1.2;
         let lArmX = -0.42;
         let lArmY = 0.15;
         let lForeX = 0.95;
         let lForeY = -0.22;

         let rArmZ = 1.2;
         let rArmX = -0.42;
         let rArmY = -0.15;
         let rForeX = 0.95;
         let rForeY = 0.22;

         if (leftArmRef.current) {
           leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, lArmZ, 0.08);
           leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, lArmX, 0.08);
           leftArmRef.current.rotation.y = THREE.MathUtils.lerp(leftArmRef.current.rotation.y, lArmY, 0.08);
         }
         if (rightArmRef.current) {
           rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, rArmZ, 0.08);
           rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, rArmX, 0.08);
           rightArmRef.current.rotation.y = THREE.MathUtils.lerp(rightArmRef.current.rotation.y, rArmY, 0.08);
         }
         if (leftForeArmRef.current) {
           leftForeArmRef.current.rotation.z = THREE.MathUtils.lerp(leftForeArmRef.current.rotation.z, 0, 0.08);
           leftForeArmRef.current.rotation.x = THREE.MathUtils.lerp(leftForeArmRef.current.rotation.x, lForeX, 0.08);
           leftForeArmRef.current.rotation.y = THREE.MathUtils.lerp(leftForeArmRef.current.rotation.y, lForeY, 0.08);
         }
         if (rightForeArmRef.current) {
           rightForeArmRef.current.rotation.z = THREE.MathUtils.lerp(rightForeArmRef.current.rotation.z, 0, 0.08);
           rightForeArmRef.current.rotation.x = THREE.MathUtils.lerp(rightForeArmRef.current.rotation.x, rForeX, 0.08);
           rightForeArmRef.current.rotation.y = THREE.MathUtils.lerp(rightForeArmRef.current.rotation.y, rForeY, 0.08);
         }
      } else {
         const breathe = Math.sin(time * 1.5) * 0.04;
         
         if (leftArmRef.current) {
           leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, -1.25, 0.05);
           leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -0.05 + breathe, 0.05);
           leftArmRef.current.rotation.y = THREE.MathUtils.lerp(leftArmRef.current.rotation.y, 0.05, 0.05);
         }
         if (rightArmRef.current) {
           rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, 1.25, 0.05);
           rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -0.05 + breathe, 0.05);
           rightArmRef.current.rotation.y = THREE.MathUtils.lerp(rightArmRef.current.rotation.y, -0.05, 0.05);
         }
         if (leftForeArmRef.current) {
           leftForeArmRef.current.rotation.z = THREE.MathUtils.lerp(leftForeArmRef.current.rotation.z, 0, 0.05);
           leftForeArmRef.current.rotation.x = THREE.MathUtils.lerp(leftForeArmRef.current.rotation.x, 0.15, 0.05);
           leftForeArmRef.current.rotation.y = THREE.MathUtils.lerp(leftForeArmRef.current.rotation.y, 0, 0.05);
         }
         if (rightForeArmRef.current) {
           rightForeArmRef.current.rotation.z = THREE.MathUtils.lerp(rightForeArmRef.current.rotation.z, 0, 0.05);
           rightForeArmRef.current.rotation.x = THREE.MathUtils.lerp(rightForeArmRef.current.rotation.x, 0.15, 0.05);
           rightForeArmRef.current.rotation.y = THREE.MathUtils.lerp(rightForeArmRef.current.rotation.y, 0, 0.05);
         }

         if (spineRef.current) {
            spineRef.current.rotation.x = THREE.MathUtils.lerp(spineRef.current.rotation.x, breathe * 0.1, 0.05);
            spineRef.current.rotation.y = THREE.MathUtils.lerp(spineRef.current.rotation.y, 0, 0.05);
            spineRef.current.rotation.z = THREE.MathUtils.lerp(spineRef.current.rotation.z, 0, 0.05);
         }

         if (neckRef.current) {
            neckRef.current.rotation.x = THREE.MathUtils.lerp(neckRef.current.rotation.x, breathe * 0.05, 0.05);
            neckRef.current.rotation.y = THREE.MathUtils.lerp(neckRef.current.rotation.y, 0, 0.05);
         }

         if (headRef.current) {
           headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, breathe * 0.15, 0.05);
           headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, Math.sin(time * 0.6) * 0.02, 0.05);
           headRef.current.rotation.z = THREE.MathUtils.lerp(headRef.current.rotation.z, Math.sin(time * 0.4) * 0.015, 0.05);
         }
      }

      if (isThinking && !isSpeaking) {
         group.current.rotation.y = Math.sin(time * 2.0) * 0.15;
      } else {
         group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.05);
      }
    }
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload('/myra.glb');

interface CustomMouthProps {
  headBone: THREE.Object3D | null;
  mouthX: number;
  mouthY: number;
  mouthZ: number;
  mouthScale: number;
  pitch: number;
  yaw: number;
  roll: number;
  isSpeaking: boolean;
}

function CustomMouth({ 
  headBone, 
  mouthX, 
  mouthY, 
  mouthZ, 
  mouthScale, 
  pitch, 
  yaw, 
  roll, 
  isSpeaking 
}: CustomMouthProps) {
  const mouthRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (headBone && mouthRef.current) {
      const time = state.clock.elapsedTime;

      // Force-update matrices to make sure world matrices are valid
      headBone.updateMatrixWorld(true);

      const headWorldPos = new THREE.Vector3();
      const headWorldQuat = new THREE.Quaternion();
      
      headBone.getWorldPosition(headWorldPos);
      headBone.getWorldQuaternion(headWorldQuat);

      // Apply coordinates offset in head local coordinate rotated space
      const localOffset = new THREE.Vector3(mouthX, mouthY, mouthZ);
      localOffset.applyQuaternion(headWorldQuat);

      // Place the mouth at the target location
      mouthRef.current.position.copy(headWorldPos).add(localOffset);

      // Create calibration rotation offset quaternion (representing degrees)
      const calibEuler = new THREE.Euler(
        THREE.MathUtils.degToRad(pitch),
        THREE.MathUtils.degToRad(yaw),
        THREE.MathUtils.degToRad(roll)
      );
      const calibQuat = new THREE.Quaternion().setFromEuler(calibEuler);

      // Combine head rotation with user orientation overrides
      const finalQuat = headWorldQuat.clone().multiply(calibQuat);
      mouthRef.current.quaternion.copy(finalQuat);

      // Speech audio open-close loops
      const openCycle = isSpeaking ? (0.15 + Math.max(0, Math.sin(time * 18)) * 0.85) : 0.08;
      const widthCycle = isSpeaking ? (0.95 + Math.cos(time * 14) * 0.15) : 0.75;

      mouthRef.current.scale.set(
        widthCycle * mouthScale,
        openCycle * mouthScale,
        mouthScale
      );
    }
  });

  return (
    <group ref={mouthRef}>
      {/* 1. Cavity background */}
      <mesh>
        <circleGeometry args={[0.018, 32]} />
        <meshBasicMaterial 
          color={0x1f0f0f} 
          side={THREE.DoubleSide} 
          transparent 
          opacity={0.98}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* 2. Tongue mesh */}
      <mesh position={[0, -0.007, 0.001]}>
        <circleGeometry args={[0.012, 32]} />
        <meshBasicMaterial 
          color={0xff6688} 
          side={THREE.DoubleSide} 
          transparent 
          opacity={0.98}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-3}
        />
      </mesh>

      {/* 3. Lip sticker stroke border */}
      <mesh position={[0, 0, 0.002]}>
        <ringGeometry args={[0.016, 0.0195, 32]} />
        <meshBasicMaterial 
          color={0x110202} 
          side={THREE.DoubleSide} 
          transparent 
          opacity={0.98}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>
    </group>
  );
}

export function Myra3D({ isSpeaking, isThinking, isListening }: { isSpeaking: boolean, isThinking?: boolean, isListening?: boolean }) {
  const [headBone, setHeadBone] = useState<THREE.Object3D | null>(null);

  // Load position calibrations from localStorage with robust defaults
  const [mouthX, setMouthX] = useState<number>(() => {
    const saved = localStorage.getItem('myra_mouth_x');
    return saved ? parseFloat(saved) : 0.0;
  });
  const [mouthY, setMouthY] = useState<number>(() => {
    const saved = localStorage.getItem('myra_mouth_y');
    return saved ? parseFloat(saved) : -0.065;
  });
  const [mouthZ, setMouthZ] = useState<number>(() => {
    const saved = localStorage.getItem('myra_mouth_z');
    return saved ? parseFloat(saved) : 0.101;
  });
  const [mouthScale, setMouthScale] = useState<number>(() => {
    const saved = localStorage.getItem('myra_mouth_scale');
    return saved ? parseFloat(saved) : 1.0;
  });

  // Load rotation calibrations from localStorage with robust defaults
  const [pitch, setPitch] = useState<number>(() => {
    const saved = localStorage.getItem('myra_mouth_pitch');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [yaw, setYaw] = useState<number>(() => {
    const saved = localStorage.getItem('myra_mouth_yaw');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [roll, setRoll] = useState<number>(() => {
    const saved = localStorage.getItem('myra_mouth_roll');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [isOpen, setIsOpen] = useState(false);

  // Synchronize calibrations to localStorage on change
  useEffect(() => {
    localStorage.setItem('myra_mouth_x', mouthX.toString());
  }, [mouthX]);

  useEffect(() => {
    localStorage.setItem('myra_mouth_y', mouthY.toString());
  }, [mouthY]);

  useEffect(() => {
    localStorage.setItem('myra_mouth_z', mouthZ.toString());
  }, [mouthZ]);

  useEffect(() => {
    localStorage.setItem('myra_mouth_scale', mouthScale.toString());
  }, [mouthScale]);

  useEffect(() => {
    localStorage.setItem('myra_mouth_pitch', pitch.toString());
  }, [pitch]);

  useEffect(() => {
    localStorage.setItem('myra_mouth_yaw', yaw.toString());
  }, [yaw]);

  useEffect(() => {
    localStorage.setItem('myra_mouth_roll', roll.toString());
  }, [roll]);

  return (
    <>
      {/* 3D WebGL Canvas background layer - z-0 */}
      <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center">
        <Canvas 
          camera={{ position: [0, 0.2, 3], fov: 45 }} 
          gl={{ alpha: true }}
          style={{ pointerEvents: 'none' }}
        >
          <ambientLight intensity={1.2} />
          <directionalLight position={[0, 2, 2]} intensity={2.5} />
          <spotLight position={[0, 4, 3]} angle={0.4} penumbra={1} intensity={1.5} castShadow />
          <Environment preset="city" />
          <ChestFramer />
          <Model 
            isSpeaking={isSpeaking} 
            isThinking={isThinking} 
            isListening={isListening}
            onHeadBoneLoaded={setHeadBone} 
          />
          {headBone && (
            <CustomMouth
              headBone={headBone}
              mouthX={mouthX}
              mouthY={mouthY}
              mouthZ={mouthZ}
              mouthScale={mouthScale}
              pitch={pitch}
              yaw={yaw}
              roll={roll}
              isSpeaking={isSpeaking}
            />
          )}
        </Canvas>
      </div>

      {/* Floating Calibration Slider Foreground Layer - z-[45] (sits above messaging area level 10) */}
      <div className="absolute inset-x-0 top-0 bottom-24 pointer-events-none z-[45]">
        <div className="absolute top-20 right-4 pointer-events-auto flex flex-col items-end gap-2">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3.5 py-2 bg-black/40 hover:bg-black/60 border border-white/10 rounded-xl backdrop-blur-md text-[10px] uppercase tracking-wider font-bold transition-all text-pink-300 pointer-events-auto shadow-lg"
          >
            <Sliders className="w-3.5 h-3.5" />
            Mouth Calibration
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {isOpen && (
            <div className="w-72 max-h-[440px] overflow-y-auto p-4 bg-black/85 border border-white/10 rounded-2xl backdrop-blur-lg flex flex-col gap-4 shadow-2xl animate-in slide-in-from-top-2 duration-200 scrollbar-thin scrollbar-thumb-white/10">
              <h4 className="text-[10px] text-pink-400 font-bold uppercase tracking-widest border-b border-white/5 pb-1.5 flex items-center justify-between w-full">
                <span>FACIAL CALIBRATION</span>
                <span className="font-mono text-[9px] text-white/40">v3.0</span>
              </h4>

              {/* Position Controls */}
              <div className="flex flex-col gap-3">
                <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold font-sans">Position Offset</span>
                
                <div className="flex flex-col gap-1 text-left w-full pl-1">
                  <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-semibold font-sans">Lateral (X)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="-0.15"
                      max="0.15"
                      step="0.001"
                      value={mouthX}
                      onChange={(e) => setMouthX(parseFloat(e.target.value))}
                      className="w-full accent-pink-500 h-1 rounded bg-white/10 appearance-none cursor-pointer"
                    />
                    <span className="text-[9px] font-mono text-white/60 w-12 text-right">{(mouthX * 100).toFixed(1)}cm</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-left w-full pl-1">
                  <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-semibold font-sans">Height (Y)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="-0.20"
                      max="0.20"
                      step="0.001"
                      value={mouthY}
                      onChange={(e) => setMouthY(parseFloat(e.target.value))}
                      className="w-full accent-pink-400 h-1 rounded bg-white/10 appearance-none cursor-pointer"
                    />
                    <span className="text-[9px] font-mono text-white/60 w-12 text-right">{(mouthY * 100).toFixed(1)}cm</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-left w-full pl-1">
                  <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-semibold font-sans">Depth (Z)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="-0.15"
                      max="0.25"
                      step="0.001"
                      value={mouthZ}
                      onChange={(e) => setMouthZ(parseFloat(e.target.value))}
                      className="w-full accent-pink-500 h-1 rounded bg-white/10 appearance-none cursor-pointer"
                    />
                    <span className="text-[9px] font-mono text-white/60 w-12 text-right">{(mouthZ * 100).toFixed(1)}cm</span>
                  </div>
                </div>
              </div>

              {/* Rotation Controls */}
              <div className="flex flex-col gap-3 border-t border-white/5 pt-3">
                <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold font-sans">Rotation Override</span>

                <div className="flex flex-col gap-1 text-left w-full pl-1">
                  <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-semibold font-sans">Pitch (X)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      step="1"
                      value={pitch}
                      onChange={(e) => setPitch(parseInt(e.target.value, 10))}
                      className="w-full accent-pink-400 h-1 rounded bg-white/10 appearance-none cursor-pointer"
                    />
                    <span className="text-[9px] font-mono text-white/60 w-12 text-right">{pitch}°</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-left w-full pl-1">
                  <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-semibold font-sans">Yaw (Y)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      step="1"
                      value={yaw}
                      onChange={(e) => setYaw(parseInt(e.target.value, 10))}
                      className="w-full accent-pink-500 h-1 rounded bg-white/10 appearance-none cursor-pointer"
                    />
                    <span className="text-[9px] font-mono text-white/60 w-12 text-right">{yaw}°</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-left w-full pl-1">
                  <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-semibold font-sans">Roll (Z)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      step="1"
                      value={roll}
                      onChange={(e) => setRoll(parseInt(e.target.value, 10))}
                      className="w-full accent-pink-400 h-1 rounded bg-white/10 appearance-none cursor-pointer"
                    />
                    <span className="text-[9px] font-mono text-white/60 w-12 text-right">{roll}°</span>
                  </div>
                </div>
              </div>

              {/* Sizing Controls */}
              <div className="flex flex-col gap-3 border-t border-white/5 pt-3">
                <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold font-sans">Scaling Size</span>

                <div className="flex flex-col gap-1 text-left w-full pl-1">
                  <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-semibold font-sans">Size Scale</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.05"
                      value={mouthScale}
                      onChange={(e) => setMouthScale(parseFloat(e.target.value))}
                      className="w-full accent-pink-500 h-1 rounded bg-white/10 appearance-none cursor-pointer"
                    />
                    <span className="text-[9px] font-mono text-white/60 w-12 text-right">{mouthScale.toFixed(2)}x</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setMouthX(0.0);
                  setMouthY(-0.065);
                  setMouthZ(0.101);
                  setMouthScale(1.0);
                  setPitch(0);
                  setYaw(0);
                  setRoll(0);
                }}
                className="text-[9px] text-pink-400 hover:text-pink-300 uppercase tracking-widest font-bold text-center mt-2 pt-2.5 border-t border-white/5 w-full flex items-center justify-center hover:underline transition-all font-sans cursor-pointer"
              >
                Reset to Defaults
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
