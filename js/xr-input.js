import * as THREE from 'three';

// Las poses de rayos, empuñaduras y articulaciones usan el mismo local-floor.
function applyPose(object, pose) {
  object.visible = Boolean(pose);
  if (!pose) return;
  object.position.copy(pose.transform.position);
  object.quaternion.copy(pose.transform.orientation);
  object.updateMatrixWorld(true);
}

export function createXRInput({scene, hitFrom, press, release}) {
  const sources = new Map();
  let session = null;
  const sphere = new THREE.SphereGeometry(1, 10, 8);
  const rayGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(), new THREE.Vector3(0, 0, -1)
  ]);
  const beamMaterial = new THREE.LineBasicMaterial({color: '#39e4d1'});
  const surface = new THREE.MeshBasicMaterial({color: '#c5fcf4'});
  const transform = new THREE.Object3D();
  const thumb = new THREE.Vector3();
  const index = new THREE.Vector3();

  function connect(source) {
    if (sources.has(source) || source.targetRayMode !== 'tracked-pointer') return;
    const ray = new THREE.Group();
    const beam = new THREE.Line(rayGeometry, beamMaterial);
    const cursor = new THREE.Mesh(sphere, surface);
    cursor.scale.setScalar(.009);
    ray.add(beam, cursor);
    const model = source.hand ? new THREE.InstancedMesh(sphere, surface, 25) : new THREE.Mesh(sphere, surface);
    if (source.hand) model.frustumCulled = false;
    else model.scale.set(.028, .036, .072);
    model.visible = ray.visible = false;
    scene.add(ray, model);
    sources.set(source, {ray, beam, cursor, model, held:null, motion:[], down:false, tracking:false});
  }
  function remove(source) {
    const state = sources.get(source);
    if (!state) return;
    release(state, true);
    scene.remove(state.ray, state.model);
    if (state.model.isInstancedMesh) state.model.dispose();
    sources.delete(source);
  }
  function changed(event) {
    for (const source of event.removed) remove(source);
    for (const source of event.added) connect(source);
  }
  function select(state, down) {
    if (down === state.down) return;
    state.down = down;
    if (!down) return release(state);
    const hit = hitFrom(state.ray);
    if (hit) press(state, hit.object, state.ray);
  }
  function trigger(event) {
    const state = sources.get(event.inputSource);
    if (!state || event.inputSource.hand) return;
    if (event.type === 'selectend' && state.held && event.frame && session.visibilityState === 'visible') {
      const space = state.referenceSpace;
      const pose = space && event.frame.getPose(event.inputSource.gripSpace || event.inputSource.targetRaySpace, space);
      if (pose) state.velocityPose = pose;
    }
    if (event.type === 'selectend' || state.tracking) select(state, event.type === 'selectstart');
  }
  function attach(next) {
    if (session === next) return;
    if (session) {
      session.removeEventListener('inputsourceschange', changed);
      session.removeEventListener('selectstart', trigger);
      session.removeEventListener('selectend', trigger);
    }
    for (const source of sources.keys()) remove(source);
    session = next;
    if (!session) return;
    session.addEventListener('inputsourceschange', changed);
    session.addEventListener('selectstart', trigger);
    session.addEventListener('selectend', trigger);
    for (const source of session.inputSources) connect(source);
  }
  function updateHand(state, hand, frame, space) {
    let count = 0, hasThumb = false, hasIndex = false;
    for (const [name, joint] of hand) {
      const pose = frame.getJointPose(joint, space);
      if (!pose) continue;
      transform.position.copy(pose.transform.position);
      transform.scale.setScalar(pose.radius || .008);
      transform.updateMatrix();
      state.model.setMatrixAt(count++, transform.matrix);
      if (name === 'thumb-tip') { thumb.copy(transform.position); hasThumb = true; }
      if (name === 'index-finger-tip') { index.copy(transform.position); hasIndex = true; }
    }
    state.model.count = count;
    state.model.instanceMatrix.needsUpdate = true;
    state.model.visible = count > 0;
    if (!hasThumb || !hasIndex) return false;
    if (state.ray.visible) select(state, thumb.distanceTo(index) < (state.down ? .028 : .018));
    return true;
  }
  function update(frame, space) {
    if (!frame || !space) return;
    for (const [source, state] of sources) {
      const active = session.visibilityState === 'visible';
      const aim = active && frame.getPose(source.targetRaySpace, space);
      state.referenceSpace = space;
      state.velocityPose = aim;
      applyPose(state.ray, aim);
      if (source.hand) {
        state.tracking = active && updateHand(state, source.hand, frame, space) && !!aim;
        if (!active) state.model.visible = false;
      } else {
        const grip = active && source.gripSpace && frame.getPose(source.gripSpace, space);
        state.velocityPose = grip || aim;
        applyPose(state.model, grip || aim);
        state.tracking = !!aim;
      }
      if (!state.tracking) {
        release(state, true);
        state.down = false;
        state.ray.visible = false;
        continue;
      }
      const hit = hitFrom(state.ray);
      const distance = hit?.distance ?? 1.5;
      state.beam.scale.z = distance;
      state.cursor.position.z = -distance;
    }
  }
  function status() {
    if (!session) return '';
    if (!sources.size) return 'Sin entradas XR · mueve los mandos o muestra las manos';
    return Array.from(sources, ([source,state]) =>
      (source.hand ? 'Mano' : 'Mando') + ' ' + ({left:'izq.',right:'der.'}[source.handedness] || '') +
      (state.tracking ? ' activo' : ' sin seguimiento')
    ).join('   ·   ');
  }
  return {attach, update, status, sources};
}
