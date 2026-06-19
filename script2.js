import fs from 'fs';
try {
  const buffer = fs.readFileSync('public/myra.glb');
  console.log('GLB File size:', buffer.length);
  
  // Check GLB Header
  const magic = buffer.toString('utf8', 0, 4);
  const version = buffer.readUInt32LE(4);
  const length = buffer.readUInt32LE(8);
  console.log(`GLB Magic: ${magic}, Version: ${version}, Length: ${length}`);
  
  if (magic !== 'glTF') {
    throw new Error('Not a valid GLb file');
  }

  // Read first chunk (JSON)
  const chunkLength = buffer.readUInt32LE(12);
  const chunkType = buffer.toString('utf8', 16, 20);
  console.log(`Chunk 0 Length: ${chunkLength}, Type: ${chunkType}`);
  
  if (chunkType !== 'JSON') {
    throw new Error('Chunk 0 is not JSON!');
  }
  
  const jsonStr = buffer.toString('utf8', 20, 20 + chunkLength);
  const gltf = JSON.parse(jsonStr);
  console.log('GLTF keys:', Object.keys(gltf));
  
  // List all meshes
  if (gltf.meshes) {
    console.log('Meshes count:', gltf.meshes.length);
    gltf.meshes.forEach((mesh, index) => {
      console.log(`Mesh ${index}: name="${mesh.name}"`);
      if (mesh.primitives && mesh.primitives[0]) {
        const prim = mesh.primitives[0];
        if (prim.targets) {
          console.log(`  Targets count: ${prim.targets.length}`);
          // Find extra target names
          if (mesh.extras && mesh.extras.targetNames) {
            console.log(`  Target Names:`, mesh.extras.targetNames);
          }
        }
      }
    });
  } else {
    console.log('No meshes property in GLTF!');
  }

  // Let's also inspect nodes to see the bone names
  if (gltf.nodes) {
    console.log('Nodes count:', gltf.nodes.length);
    const boneNodes = gltf.nodes.filter(n => n.name && (
      n.name.toLowerCase().includes('head') ||
      n.name.toLowerCase().includes('jaw') ||
      n.name.toLowerCase().includes('mouth') ||
      n.name.toLowerCase().includes('arm') ||
      n.name.toLowerCase().includes('shoulder')
    ));
    console.log('Matches (head/jaw/mouth/arm/shoulder):', boneNodes.map(n => n.name));
  }

} catch (e) {
  console.error('Error running script:', e.message);
}




