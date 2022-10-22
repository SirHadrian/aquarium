import {
  Scene,
  BoxGeometry,
  Mesh,
  WebGLRenderer,
  PerspectiveCamera,
  sRGBEncoding,
  ColorRepresentation,
  MeshStandardMaterial,
  Vector3,
  Group,
  Object3D,
  DoubleSide,
  TextureLoader,
  Texture,
  SphereGeometry,
  MeshBasicMaterial,
  AmbientLight,
} from 'three';
import * as dat from 'dat.gui'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';



class SceneSetup extends Scene {

  constructor() {

    super();

  }

}


class CameraSetup extends PerspectiveCamera {

  constructor( fov: number, aspectRatio: number, nearDistance: number, farDistance: number ) {

    super( fov, aspectRatio, nearDistance, farDistance );

    this.position.set( 0, 0, 200 );
    this.lookAt( 0, 0, 0 );
  }
}


class RendererSetup extends WebGLRenderer {

  constructor( configs: object, camera: CameraSetup ) {

    super( configs );

    this.setSize( window.innerWidth, window.innerHeight );
    this.setPixelRatio( window.devicePixelRatio );
    this.outputEncoding = sRGBEncoding;

    // Inject renderer to DOM
    const target = document.getElementById( "app" );
    target?.appendChild( this.domElement );

    // OrbitControls
    new OrbitControls( camera, this.domElement );
  }
}


class LightSetup extends AmbientLight {

  constructor( scene: Scene, color: ColorRepresentation, intensity: number ) {

    super( color, intensity );

    this.position.set( 0, 50, 100 );

    // DEBUG light
    const light_sphere = new Mesh(
      new SphereGeometry( 10, 10, 10 ),
      new MeshBasicMaterial( {
        color: 0xffffff,
      } )
    );
    light_sphere.position.set( this.position.x, this.position.y, this.position.z );
    scene.add( light_sphere );
    // ===========

    scene.add( this );
  }
}


class Simualtion {

  #fish_type_1: Group;
  #fish_type_2: Group;
  #sharks: Group;
  #lines: Group;

  static configs = {
    shark_seek_radius: 50,
    fish_number: 200,
    sharks_number: 2,
    light_intensity: 1,
    boid_size: 1,
    fish_speed: 0.5,
    shark_speed: 0.3,
    aligment_force: 0.05,
    cohesion_force: 0.1,
    separation_force: 1.05,
    aligment_radius: 15,
    cohesion_radius: 5,
    separation_radius: 5,
    container_opacity: 0.1,
    container_scale: 2,
    container_size: 100,
    gui_width: 300,
    ground_offset: 10,
  }


  constructor() {

    this.#fish_type_1 = new Group();
    this.#fish_type_2 = new Group();

    this.#lines = new Group();
    this.#sharks = new Group();

    this.#create_sharks();
    this.#create_fish();
  }

  get fish_type_1 () {
    return this.#fish_type_1;
  }

  get fish_type_2 () {
    return this.#fish_type_2;
  }

  get sharks () {
    return this.#sharks;
  }

  get lines () {
    return this.#lines;
  }


  initSkyBox (): Texture {

    const backgroundLoader = new TextureLoader();
    const texture = backgroundLoader.load( './assets/background.jpg' );

    return texture;
  }


  create_container () {
    const container = new Mesh(
      new BoxGeometry( Simualtion.configs.container_size, Simualtion.configs.container_size, Simualtion.configs.container_size ),
      new MeshStandardMaterial( {
        transparent: true,
        opacity: Simualtion.configs.container_opacity,
        color: 0xffffff
      } )
    );
    container.position.set( 0, 0, 0 );
    container.scale.set( Simualtion.configs.container_scale, Simualtion.configs.container_scale, Simualtion.configs.container_scale );

    return container;
  }


  separation ( boid: Object3D, boids: Group ): Vector3 {


    let steering = new Vector3( 0, 0, 0 );

    if ( boids.children.length <= 1 ) return steering;

    let total = 0;

    boids.children.forEach( ( other ) => {

      let distance = boid.position.distanceTo( other.position );

      if ( distance < Simualtion.configs.separation_radius ) {

        let diff = new Vector3().subVectors( boid.position, other.position );
        diff.divideScalar( Simualtion.configs.separation_radius );

        steering.add( diff );
        total++;
      }
    } );

    steering.divideScalar( total );

    steering.multiplyScalar( Simualtion.configs.separation_force );

    return steering;
  }


  cohesion ( boid: Object3D, boids: Group ): Vector3 {


    let steering = new Vector3( 0, 0, 0 );

    if ( boids.children.length <= 1 ) return steering;

    let total = 0;

    boids.children.forEach( ( other ) => {

      let distance = boid.position.distanceTo( other.position );

      if ( distance < Simualtion.configs.cohesion_radius ) {
        steering.add( other.position );
        total++;
      }
    } );

    steering.divideScalar( total );
    steering.sub( boid.position );
    steering.multiplyScalar( Simualtion.configs.cohesion_force );

    return steering;
  }


  aligment ( boid: Object3D, boids: Group ): Vector3 {


    let steering = new Vector3( 0, 0, 0 );

    if ( boids.children.length <= 1 ) return steering;

    let total = 0;

    boids.children.forEach( ( other ) => {

      let distance = boid.position.distanceTo( other.position );

      if ( distance < Simualtion.configs.aligment_radius ) {
        steering.add( other.userData.velocity );
        total++;
      }
    } );

    steering.divideScalar( total );
    steering.normalize();
    steering.sub( boid.userData.velocity );
    steering.multiplyScalar( Simualtion.configs.aligment_force );

    return steering;
  }


  checkEdges ( boid: Object3D ) {

    const scale = Simualtion.configs.container_size * Simualtion.configs.container_scale;

    const width = scale / 2;
    const height = scale / 2;
    const depth = scale / 2;

    // x col
    if ( boid.position.x < -width ) {
      boid.position.x = width;
    } else if ( boid.position.x > width ) {
      boid.position.x = -width;
    }

    // y col
    if ( boid.position.y < -height ) {
      boid.position.y = height;
    } else if ( boid.position.y > height ) {
      boid.position.y = -height;
    }

    // z col
    if ( boid.position.z < -depth ) {
      boid.position.z = depth;
    } else if ( boid.position.z > depth ) {
      boid.position.z = -depth;
    }

  }


  apply_ground_avoidance ( boid: Object3D ): Vector3 {

    const position = boid.position;
    const ground_offset = Simualtion.configs.ground_offset;

    const ground = -( ( Simualtion.configs.container_size * Simualtion.configs.container_scale ) / 2 );
    const surface = ( ( Simualtion.configs.container_size * Simualtion.configs.container_scale ) / 2 );

    let force = new Vector3( 0, 0, 0 );

    if ( position.y < ground + ground_offset ) {
      force = new Vector3( position.x, -1 * position.y, position.z );
    } else if ( position.y > surface - ground_offset ) {
      force = new Vector3( position.x, -1 * position.y, position.z );
    }
    return force;
  }

  #shark_avoidance ( boid: Object3D, sharks: Group ) {

    let avoid_force = new Vector3( 0, 0, 0 );

    sharks.children.forEach( ( shark ) => {

      let distance = boid.position.distanceTo( shark.position );

      if ( distance < Simualtion.configs.shark_seek_radius ) {
        avoid_force = boid.position.clone().sub( shark.position ).normalize();
      }
    } );

    return avoid_force;
  }


  #calculate_fish_status ( boid: Object3D, fish_type: Group ) {

    boid.position.add(
      boid.userData.velocity
        .add( boid.userData.acceleration )
        .normalize()
        .multiplyScalar( Simualtion.configs.fish_speed )
    );
    boid.lookAt( boid.position.clone().add( boid.userData.velocity ) );


    // Reset acceleration
    boid.userData.acceleration.multiplyScalar( 0 );

    const aligment = this.aligment( boid, fish_type );
    boid.userData.acceleration.add( aligment );

    const cohesion = this.cohesion( boid, fish_type );
    boid.userData.acceleration.add( cohesion );

    const separation = this.separation( boid, fish_type );
    boid.userData.acceleration.add( separation );

    const ground_avoidance = this.apply_ground_avoidance( boid );
    boid.userData.acceleration.add( ground_avoidance );

    const avoid_force = this.#shark_avoidance( boid, this.sharks );
    boid.userData.acceleration.add( avoid_force );


    this.checkEdges( boid );

  }


  #calculate_shark_status ( boid: Object3D ) {

    boid.position.add(
      boid.userData.velocity
        .add( boid.userData.acceleration )
        .normalize()
        .multiplyScalar( Simualtion.configs.shark_speed )
    );
    boid.lookAt( boid.position.clone().add( boid.userData.velocity ) );

    // Reset acceleration
    boid.userData.acceleration.multiplyScalar( 0 );

    const ground_avoidance = this.apply_ground_avoidance( boid );
    boid.userData.acceleration.add( ground_avoidance.setY( ground_avoidance.y * 0.2 ) );

    this.checkEdges( boid );

  }




  animate_boids () {

    this.fish_type_1.children.forEach( ( boid ) => {
      this.#calculate_fish_status( boid, this.fish_type_1 );
    } );

    this.fish_type_2.children.forEach( ( boid ) => {
      this.#calculate_fish_status( boid, this.fish_type_2 );
    } );

    this.sharks.children.forEach( ( boid ) => {
      this.#calculate_shark_status( boid );
    } );

  }


  #create_fish () {

    const loader = new MTLLoader();

    loader.setMaterialOptions( {
      side: DoubleSide
    } );

    loader.load( './assets/objects/fish_1/fish.mtl', ( material ) => {

      material.preload();

      const objLoader = new OBJLoader();

      objLoader.setMaterials( material );
      objLoader.load( './assets/objects/fish_1/fish.obj', ( object ) => {

        for ( let i = 0; i < Simualtion.configs.fish_number / 2; ++i ) {
          const fish = object.clone();

          fish.scale.set(
            Simualtion.configs.boid_size + 1.5,
            Simualtion.configs.boid_size + 1.5,
            Simualtion.configs.boid_size + 1.5
          );

          fish.position.set(
            ( Simualtion.configs.container_size - Simualtion.configs.ground_offset ) * ( Math.random() - 0.5 ),
            ( Simualtion.configs.container_size - Simualtion.configs.ground_offset ) * ( Math.random() - 0.5 ),
            ( Simualtion.configs.container_size - Simualtion.configs.ground_offset ) * ( Math.random() - 0.5 )
          );

          fish.userData.velocity = new Vector3().randomDirection();
          fish.userData.acceleration = new Vector3( 0, 0, 0 );
          fish.userData.isFish = true;

          fish.lookAt( fish.position.clone().add( fish.userData.velocity ) );

          fish.castShadow = true;
          fish.receiveShadow = true;

          this.fish_type_1.add( fish );
        }
      } )
    } );

    loader.load( './assets/objects/fish_2/fish.mtl', ( material ) => {
      material.preload();

      const objLoader = new OBJLoader();

      objLoader.setMaterials( material );
      objLoader.load( './assets/objects/fish_2/fish.obj', ( object ) => {

        for ( let i = 0; i < Simualtion.configs.fish_number / 2; ++i ) {
          const fish = object.clone();

          fish.scale.set(
            Simualtion.configs.boid_size,
            Simualtion.configs.boid_size,
            Simualtion.configs.boid_size
          );

          fish.position.set(
            ( Simualtion.configs.container_size - Simualtion.configs.ground_offset ) * ( Math.random() - 0.5 ),
            ( Simualtion.configs.container_size - Simualtion.configs.ground_offset ) * ( Math.random() - 0.5 ),
            ( Simualtion.configs.container_size - Simualtion.configs.ground_offset ) * ( Math.random() - 0.5 )
          );

          fish.userData.velocity = new Vector3().randomDirection();
          fish.userData.acceleration = new Vector3( 0, 0, 0 );
          fish.userData.isFish = true;

          fish.lookAt( fish.position.clone().add( fish.userData.velocity ) );

          fish.castShadow = true;
          fish.receiveShadow = true;

          this.fish_type_2.add( fish );
        }
      } )
    } );
  }


  #create_sharks () {

    const loader = new MTLLoader();

    loader.setMaterialOptions( {
      side: DoubleSide
    } );

    loader.load( './assets/objects/fish_3/Shark.mtl', ( material ) => {
      material.preload();

      const objLoader = new OBJLoader();

      objLoader.setMaterials( material );
      objLoader.load( './assets/objects/fish_3/Shark.obj', ( object ) => {

        for ( let i = 0; i < Simualtion.configs.sharks_number; ++i ) {
          const fish = object.clone();

          fish.scale.set(
            Simualtion.configs.boid_size + 1.6,
            Simualtion.configs.boid_size + 1.6,
            Simualtion.configs.boid_size + 1.6
          );

          fish.position.set(
            ( Simualtion.configs.container_size - Simualtion.configs.ground_offset ) * ( Math.random() - 0.5 ),
            ( Simualtion.configs.container_size - Simualtion.configs.ground_offset ) * ( Math.random() - 0.5 ),
            ( Simualtion.configs.container_size - Simualtion.configs.ground_offset ) * ( Math.random() - 0.5 )
          );

          fish.userData.velocity = new Vector3().randomDirection();
          fish.userData.acceleration = new Vector3( 0, 0, 0 );
          fish.userData.isShark = true;

          fish.lookAt( fish.position.clone().add( fish.userData.velocity ) );

          fish.castShadow = true;
          fish.receiveShadow = true;

          this.#sharks.add( fish );
        }
      } )
    } );
  }

// Debug only
  recreate_boids () {

    this.fish_type_1.remove( ...this.fish_type_1.children );
    this.fish_type_2.remove( ...this.fish_type_2.children );
    this.#create_fish();


    this.sharks.remove( ...this.sharks.children );
    this.#create_sharks();

  }
}

function main () {

  //#region INIT
  // Create Scene
  const scene = new SceneSetup();

  // Create Camera
  const camera = new CameraSetup(
    50, // FOV
    window.innerWidth / window.innerHeight, // Aspect ratio
    0.1, // Near: distance objects apear on camera
    1000, // Far: distance objects disapear from camera
  );

  // Create Renderer
  const renderer = new RendererSetup( { antialiasing: true }, camera );

  // Create light source
  const light = new LightSetup(
    scene,
    0xffffff,
    1
  );
  scene.add( light );
  //#endregion


  //#region PlayGround

  // Simualtion
  const simulation = new Simualtion();

  scene.background = simulation.initSkyBox();

  scene.add( simulation.fish_type_1 );
  scene.add( simulation.fish_type_2 );
  scene.add( simulation.sharks );

  const container = simulation.create_container();
  scene.add( container );

  //#endregion


  //#region GUI
  const gui = new dat.GUI( { width: Simualtion.configs.gui_width } );

  gui.add( Simualtion.configs, "fish_number", 100, 500, 10 ).onChange( () => simulation.recreate_boids() );
  gui.add( Simualtion.configs, "sharks_number", 1, 10, 1 ).onChange( () => simulation.recreate_boids() );

  gui.add( Simualtion.configs, "boid_size", 0.1, 2, 0.1 ).onChange( () => simulation.recreate_boids() );

  gui.add( Simualtion.configs, "fish_speed", 0.1, 1, 0.1 );
  gui.add( Simualtion.configs, "shark_speed", 0.1, 2, 0.1 );

  gui.add( Simualtion.configs, "aligment_force", 0, 0.5, 0.05 );
  gui.add( Simualtion.configs, "cohesion_force", 0, 0.5, 0.05 );
  gui.add( Simualtion.configs, "separation_force", 1, 1.5, 0.05 );

  gui.add( Simualtion.configs, "aligment_radius", 5, 30, 5 );
  gui.add( Simualtion.configs, "cohesion_radius", 5, 30, 5 );
  gui.add( Simualtion.configs, "separation_radius", 5, 30, 5 );

  gui.add( Simualtion.configs, "container_scale", 1, 5, 1 ).onChange( () => container.scale.set( Simualtion.configs.container_scale, Simualtion.configs.container_scale, Simualtion.configs.container_scale ) );
  gui.add( Simualtion.configs, "container_opacity", 0, 1, 0.1 ).onChange( () => container.material.opacity = Simualtion.configs.container_opacity );


  //#endregion


  //#region Main loop and events

  // On window resize
  const resize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
  }
  window.addEventListener( "resize", resize, false );

  // Animation loop
  const animate = () => {

    simulation.animate_boids();

    renderer.render( scene, camera );
    requestAnimationFrame( animate );
  }
  animate();

  //#endregion
}

main();
