import {
  Scene,
  BoxGeometry,
  CubeTextureLoader,
  Mesh,
  WebGLRenderer,
  PerspectiveCamera,
  sRGBEncoding,
  AmbientLight,
  ColorRepresentation,
  MeshStandardMaterial,
  Vector3,
  Group,
  Object3D,
  DoubleSide,
  CubeTexture,
  TextureLoader,
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

    this.position.set( 0, 0, 10 );
    scene.add( this );
  }
}


class Simualtion {

  #fish_type_1: Group;
  #fish_type_2: Group;
  #sharks: Group;
  #lines: Group;

  static configs = {
    fish_number: 10,
    sharks_number: 2,
    light_intensity: 1,
    boid_size: 0.5,
    fish_speed: 0.5,
    shark_speed: 0.3,
    aligment_force: 0.05,
    cohesion_force: 0.1,
    separation_force: 1.05,
    aligment_radius: 15,
    cohesion_radius: 5,
    separation_radius: 5,
    container_opacity: 0,
    container_scale: 1,
    container_size: 100,
    gui_width: 300,
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


  initSkyBox (): CubeTexture {
    const skybox = new CubeTextureLoader()
      .setPath( './assets/red/' )
      .load( [
        'bkg3_right1.png',
        'bkg3_left2.png',
        'bkg3_top3.png',
        'bkg3_bottom4.png',
        'bkg3_front5.png',
        'bkg3_back6.png',
      ] );
    return skybox;
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

    const negEdge = ( -1 * Simualtion.configs.container_size / 2 * Simualtion.configs.container_scale ) - Simualtion.configs.boid_size;
    const posEdge = ( Simualtion.configs.container_size / 2 * Simualtion.configs.container_scale ) - Simualtion.configs.boid_size;

    const offset = Simualtion.configs.boid_size;


    if ( boid.position.x < negEdge ) {
      boid.position.x += offset;
      boid.userData.velocity.x *= -1;
    } else if ( boid.position.x > posEdge ) {
      boid.position.x -= offset;
      boid.userData.velocity.x *= -1;
    }

    if ( boid.position.y < negEdge ) {
      boid.position.y += offset;
      boid.userData.velocity.y *= -1;
    } else if ( boid.position.y > posEdge ) {
      boid.position.y -= offset;
      boid.userData.velocity.y *= -1;
    }

    if ( boid.position.z < negEdge ) {
      boid.position.z += offset;
      boid.userData.velocity.z *= -1;
    } else if ( boid.position.z > posEdge ) {
      boid.position.z -= offset;
      boid.userData.velocity.z *= -1;
    }
  }


  #calculate_fish_status ( boid: Object3D, fish_type: Group ) {

    let aligment = new Vector3( 0, 0, 0 );
    let cohesion = new Vector3( 0, 0, 0 );
    let separation = new Vector3( 0, 0, 0 );

    boid.position.add(
      boid.userData.velocity
        .add( boid.userData.acceleration )
        .normalize()
        .multiplyScalar( Simualtion.configs.fish_speed )
    );
    boid.lookAt( boid.position.clone().add( boid.userData.velocity ) );

    // Reset acceleration
    boid.userData.acceleration.multiplyScalar( 0 );

    aligment = this.aligment( boid, fish_type );
    boid.userData.acceleration.add( aligment );

    cohesion = this.cohesion( boid, fish_type );
    boid.userData.acceleration.add( cohesion );

    separation = this.separation( boid, fish_type );
    boid.userData.acceleration.add( separation );

    // TODO run from sharks

    this.checkEdges( boid );

  }


  animateBoids () {

    this.fish_type_1.children.forEach( ( boid ) => {
      this.#calculate_fish_status( boid, this.fish_type_1 );
    } );

    this.fish_type_2.children.forEach( ( boid ) => {
      this.#calculate_fish_status( boid, this.fish_type_2 );
    } );

    this.sharks.children.forEach( ( boid ) => {

      boid.position.add(
        boid.userData.velocity
          .add( boid.userData.acceleration )
          .normalize()
          .multiplyScalar( Simualtion.configs.shark_speed )
      );
      boid.lookAt( boid.position.clone().add( boid.userData.velocity ) );

      // Reset acceleration
      boid.userData.acceleration.multiplyScalar( 0 );

      // TODO run after fish 

      this.checkEdges( boid );
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
            Simualtion.configs.container_size * ( Math.random() - 0.5 ),
            Simualtion.configs.container_size * ( Math.random() - 0.5 ),
            Simualtion.configs.container_size * ( Math.random() - 0.5 )
          );

          fish.userData.velocity = new Vector3().randomDirection();
          fish.userData.acceleration = new Vector3( 0, 0, 0 );

          fish.lookAt( fish.position.clone().add( fish.userData.velocity ) );

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
            Simualtion.configs.container_size * ( Math.random() - 0.5 ),
            Simualtion.configs.container_size * ( Math.random() - 0.5 ),
            Simualtion.configs.container_size * ( Math.random() - 0.5 )
          );

          fish.userData.velocity = new Vector3().randomDirection();
          fish.userData.acceleration = new Vector3( 0, 0, 0 );

          fish.lookAt( fish.position.clone().add( fish.userData.velocity ) );

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
            Simualtion.configs.container_size * ( Math.random() - 0.5 ),
            Simualtion.configs.container_size * ( Math.random() - 0.5 ),
            Simualtion.configs.container_size * ( Math.random() - 0.5 )
          );

          fish.userData.velocity = new Vector3().randomDirection();
          fish.userData.acceleration = new Vector3( 0, 0, 0 );

          fish.lookAt( fish.position.clone().add( fish.userData.velocity ) );

          this.#sharks.add( fish );
        }
      } )
    } );
  }


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

  //scene.background = simulation.initSkyBox();
  const backgroundLoader = new TextureLoader();
  const texture = backgroundLoader.load( './assets/background.jpg' );
  scene.background = texture;

  scene.add( simulation.fish_type_1 );
  scene.add( simulation.fish_type_2 );
  scene.add( simulation.sharks );

  const container = simulation.create_container();
  scene.add( container );

  //scene.add( simulation.lines );
  //#endregion


  //#region GUI
  const gui = new dat.GUI( { width: Simualtion.configs.gui_width } );

  gui.add( Simualtion.configs, "fish_number", 10, 500, 10 ).onChange( () => simulation.recreate_boids() );
  gui.add( Simualtion.configs, "sharks_number", 1, 10, 1 ).onChange( () => simulation.recreate_boids() );

  gui.add( Simualtion.configs, "boid_size", 0.1, 2, 0.1 ).onChange( () => simulation.recreate_boids() );

  gui.add( Simualtion.configs, "fish_speed", 0.1, 2, 0.1 );
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

    simulation.animateBoids();

    renderer.render( scene, camera );
    requestAnimationFrame( animate );
  }
  animate();

  //#endregion
}

main();
