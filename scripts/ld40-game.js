RocketBoots.loadComponents([
	"Game",
	"Coords",
	"StateMachine",
	"Dice",
	"Entity",
	"Loop",
	"Stage",
	"World",
	"Keyboard",
	//"ImageBank"
]).ready(function(){

	const WORLD_SIZE_X = 100,
		WORLD_SIZE_Y = 100,
		GRID_SIZE_X = 80,
		GRID_SIZE_Y = 60,
		PIXELS_PER_GRID_UNIT = 32,
		IMMIGRATION_COOL = 200,
		POPULATION_SLOW_THRESHOLD = 100,
		MAX_POPULATION = 300;

	const worldOptions = {
		name: "Space",
		isBounded: true,
		entityGroups: ["stars", "ships", "ui"],
		size: {x: WORLD_SIZE_X, y: WORLD_SIZE_Y}
	};
	const stageOptions = {
		pixelScale: 1
	};

	const states = {
		/*
		"setup": {
			start: startSetup
		},
		"splash": {
			start: startSplashState,
			end: endSplashState
		},
		"space": {
			start: startSpaceState,
			end: endSpaceState
		},
		"build": {
			start: startBuildState,
			end: endBuildState
		},
		"pause": {

		}
		*/
	};

	var g = new RocketBoots.Game({
		name: "LD40",
		instantiateComponents: [
			{"state": "StateMachine", "options": {"states": states}},
			//{"loop": "Loop"},
			{"dice": "Dice"},
			//{"world": "World", "options": worldOptions},
			//{"stage": "Stage", "options": stageOptions},
			//{"images": "ImageBank"},
			{"keyboard": "Keyboard"}
		],
		version: "ld40-v0.0.0"
	});

	var $version;
	const $window = $(window);
	const canvasElt = document.getElementById("pixi-view");
	const pixiTextureCache = PIXI.utils.TextureCache;
	const grid = new Grid({
		x: GRID_SIZE_X, y: GRID_SIZE_Y, 
		groundY: Math.round(GRID_SIZE_Y/3),
		pixelsPerGridUnit: PIXELS_PER_GRID_UNIT
	});

	const app = new PIXI.Application({
		width: $window.width(),
		height: $window.height(),
		transparent: true
	});
	canvasElt.appendChild(app.view);

	g.immigrationCooldown = IMMIGRATION_COOL;
	g.center = {x: (app.renderer.width / 2), y: (app.renderer.height / 2)};

	g.tools = ["dig", "build", "info", "move"];
	g.selectedTool = "pan"; 
	g.selectedPersonIndex = null;
	g.selectedBlock = null;
	g.blocks = [];
	g.people = [];
	g.snow = [];
	g.smoke = [];
	g.fixtures = [];

	// Setup stage containers

	g.planet = new PIXI.Container(); // parent container
	g.containers = {};
	let containerNames = [
		"backdrop", // back-dirt, invisible sky
		//"piles",
		//"items",
		"air",
		"fixtures",  // blocks that are furniture
		"people",
		"terrain", // blocks that are ground, walls
		"smoke",
		"snow"
	];
	_.each(containerNames, (containerName) => {
		if (containerName === "smoke" || containerName === "snow") {
			g.containers[containerName] = new PIXI.ParticleContainer(5000, {alpha: true})
		} else {
			g.containers[containerName] = new PIXI.Container();
		}
		g.planet.addChild(g.containers[containerName]);
	});
	

	app.stage.addChild(g.planet);
	{
		let planetStageSize = grid.getStageCoordsFromGridXY(GRID_SIZE_X, GRID_SIZE_Y);
		g.planet.x = (app.renderer.width - planetStageSize.x) / 2;
		g.planet.y = (app.renderer.height - planetStageSize.y) / 6;
	}
	/*
	let colorFilter = new PIXI.filters.ColorMatrixFilter();
	colorFilter.matrix = [
		//R  G  B  A
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		0, 0, 0, 1
	];
	*/


	PIXI.loader
		.add([
			"images/dirt.png",
			"images/dirt_wall.png",
			"images/empty.png",
			"images/man.png",
			"images/man_resting.png",
			"images/woman.png",
			"images/mutant.png",
			"images/dead_man.png",
			"images/fire_1.png",
			"images/fire_2.png",
			"images/fire_3.png",
			"images/particles/snow_1.png",
			"images/particles/snow_2.png",
			"images/particles/smoke_1.png",
			"images/particles/smoke_2.png",
			"images/particles/smoke_3.png",
			"images/particles/smoke_4.png"
		])
		.load(startGame);

	//g.state.transition("setup");

	g.app = app;
	g.grid = grid;
	g.tick = 0;
	window.g = g;
	console.log(g);
	return g;

	// Hoisted functions

	//==========================================================================

	function startGame() {
		// Create planet's content
		createLandInGrid();
		createFirstPerson();
		// Setup
		setupEvents();
		// Listen for animate update
		app.ticker.add(tick);
		// Refresh UI
		refreshToolboxUI();
		$("#backTitle").fadeOut(10000);
	}

	function tick(delta) {
		g.tick++;
		const graph = []; // TODO: Get this graph based on the current state of the planet
		let removeOne = null;
		_.each(g.people, (person) => {
			person.think();
			person.act(delta);
			person.absorbRadiation(delta);
			if (person.decay <= 0) {
				removeOne = person;
			}
		});
		if (removeOne) { removePerson(removeOne); }
		if (g.immigrationCooldown-- <= 0) {
			createImmigrant();
		}
		if (g.dice.roll1d(5) == 1) {
			createSnow();
		}
		_.each(g.snow, dropSnow);
		//let x = g.snow.length;
		//let z = _.filter(g.snow, (snow) => { return snow.alpha <= 0; });
		_.remove(g.snow, (snow) => { return snow.alpha <= 0; });

		if (g.tick % 360 === 0) {
			console.log("refresh", g.tick, g.tick % 360)
			refreshStatsUI();
		}
		if (g.tick % 10 === 0) {
			_.each(g.fixtures, (fixture) => {
				fixture.animate();
			});
		}
		if (g.tick > 100000) {
			g.tick = 0;
		}
	}

	function createLandInGrid() {
		let x, y;
		for (x = 0; x < GRID_SIZE_X; x++) {
			let isMiddle = (x === GRID_SIZE_X/2);
			if (!(grid[x] instanceof Array)) {
				grid[x] = [];
			}
			for (y = 0; y < GRID_SIZE_Y; y++) {
				let gridPos = new RocketBoots.Coords(x, y);
				let texture;
				let entity;
				let s;
				let containerName;
				let click;
				if (y >= grid.groundY) {
					if (isMiddle && y < grid.groundY + 3) {
						texture = pixiTextureCache["images/dirt_wall.png"];
						containerName = "backdrop";
						entity = new Air({
							name: "cave air",
							gridPos: gridPos
						});
					} else {
						texture = pixiTextureCache["images/dirt.png"];
						containerName = "terrain";
						entity = new Block({
							name: "dirt",
							gridPos: gridPos
						});
					}
				} else { // Sky
					texture = pixiTextureCache["images/empty.png"];
					containerName = "air";
					entity = new Air({
						name: "air",
						gridPos: gridPos
					});
				}
				s = new PIXI.Sprite(texture);
				let stagePos = grid.getStageCoordsFromGridCoords(gridPos);
				s.x = stagePos.x;
				s.y = stagePos.y;
				s.width = 32;
				s.height = 32;
				s.anchor.set(0.5);
				s.interactive = true;
				s.buttonMode = true;
				s.on("pointerup", selectBlock);
				s.on("pointerover", onSpriteOver);
				s.on("pointerout", onSpriteOut);
				g.containers[containerName].addChild(s);

				// Link entity and sprite together
				s.entity = entity;
				entity.sprite = s;

				grid[x][y] = new GridSquare({
					grid: grid,
					gridPos: gridPos.clone(),
					entity: entity
				});
			}
		}
		grid.size = new RocketBoots.Coords(GRID_SIZE_X, GRID_SIZE_Y);
	}

	function createFirstPerson() {
		g.immigrationCooldown = IMMIGRATION_COOL / 2;
		return createPerson(grid.size.x / 2, grid.groundY );
	}

	function createImmigrant() {
		if (g.people.length >= MAX_POPULATION) {
			return false;
		}
		const x = (g.dice.flip()) ? 0 : (grid.size.x - 1);
		const person = createPerson(x, grid.groundY - 1);
		g.immigrationCooldown = IMMIGRATION_COOL;
		if (g.people.length > POPULATION_SLOW_THRESHOLD) {
			g.immigrationCooldown *= 2;
		}
		return person;
	}

	function createPerson(x, y) {
		let gridPos = { x: x, y: y };
		let person = new Person({
			textures: {
				walking: pixiTextureCache["images/woman.png"],
				resting: pixiTextureCache["images/woman.png"],
				mutant: pixiTextureCache["images/mutant.png"],
				dead: pixiTextureCache["images/dead_man.png"]
			},
			gridPos: gridPos,
			grid: grid,
			people: g.people
		});
		if (person.isMale) {
			person.textures.walking = pixiTextureCache["images/man.png"];
			person.textures.resting = pixiTextureCache["images/man_resting.png"]
		}
		let s = person.sprite = new PIXI.Sprite(person.textures.walking);
		let stagePos = grid.getStageCoordsFromGridCoords(gridPos);
		s.x = stagePos.x;
		s.y = stagePos.y;
		s.width = 64;
		s.height = 64;
		s.interactive = true;
		s.buttonMode = true;
		s.anchor.set(0.5, 0.75);

		//s.filters = [colorFilter];
		//colorFilter.brightness(0.5, false);

		// Setup events
		s.on("pointerup", selectPointedPerson);
		s.on("pointerover", onSpriteOver);
		s.on("pointerout", onSpriteOut);
		g.containers.people.addChild(s);
		// Link together
		s.entity = person;
		person.sprite = s;

		g.people.push(person);
		return person;
	}

	function createSnow() {
		const stageSize = grid.getStageCoordsFromGridCoords(grid.size);
		//const n = g.dice.roll1d(2);
		const texture = pixiTextureCache["images/particles/snow_1.png"];
		if (!texture) {
			console.warn("!");
			return;
		}
		const snow = new PIXI.Sprite(texture);
		snow.y = 0; // top
		snow.x = g.dice.roll1d(stageSize.x) - 1;
		snow.mass = g.dice.roll1d(5);
		snow.alpha = 0.5 + ((snow.mass / 5) * 0.5);
		snow.width = 12;
		snow.height = 12;
		//console.log(snow.y, snow.x);
		g.snow.push(snow);
		g.containers.snow.addChild(snow);
	}

	function dropSnow(snow) {
		const stageSize = grid.getStageCoordsFromGridCoords(grid.size);
		const offset = (grid.pixelsPerGridUnit / 2);
		if (snow.y >= (grid.getStageGroundY() + offset)) {
			if (snow.alpha = 0) { snow.alpha -= 0.01; }
			else { snow.alpha = 0; }
		} else if (snow.y < (stageSize.y - 1)) {
			snow.y += snow.mass / 8;
		}
		if (snow.alpha == 0) {
			g.containers.snow.removeChild(snow);
		}
	}

	function removePerson(person) {
		g.containers.people.removeChild(person.sprite);
		const i = _.findIndex(g.people, (personCheck) => { return (personCheck === person); });
		g.people.splice(i, 1);
	}

	function buildFire(block) {
		if (!(block instanceof Air)) {
			return false;
		}
		const gridPos = block.gridPos;
		const stagePos = grid.getStageCoordsFromGridCoords(gridPos);
		const texture = pixiTextureCache["images/fire_1.png"];
		const newFixture = new Fixture({
			name: "fire",
			gridPos: gridPos,
			textures: [
				texture,
				pixiTextureCache["images/fire_2.png"],
				pixiTextureCache["images/fire_3.png"]
			]
		});
		
		const s = new PIXI.Sprite(texture);
		s.x = stagePos.x;
		s.y = stagePos.y;
		s.width = 32;
		s.height = 32;
		s.anchor.set(0.5, 0.5);

		//g.containers.air.removeChild(sprite);
		g.containers.fixtures.addChild(s);
		s.entity = newFixture;
		newFixture.sprite = s;
		grid[gridPos.x][gridPos.y].entity = newFixture;
		g.fixtures.push(newFixture);
	}

	function dig(block) {
		if (!(block instanceof Block || block instanceof Fixture)) {
			return false;
		}
		const gridPos = block.gridPos;
		const sprite = block.sprite;
		const newEntity = new Air({
			name: "air",
			gridPos: gridPos
		});
		sprite.texture = pixiTextureCache["images/dirt_wall.png"];
		g.containers.terrain.removeChild(sprite);
		g.containers.backdrop.addChild(sprite);
		sprite.entity = newEntity;
		newEntity.sprite = sprite;
		grid[gridPos.x][gridPos.y].entity = newEntity;
	}

	function onSpriteOver() {
		this.alpha = 0.9;
	}
	function onSpriteOut() {
		this.alpha = 1;
	}

	//==========================================SELECT STUFF====================

	function selectTool(toolName) {
		g.selectedTool = toolName;
		if (toolName === "move") {
			selectPersonByIndex(0);
		}
		refreshToolboxUI();
		refreshInfoBoxUI();
	}

	function selectBlock() {
		if (g.selectedTool === "dig") {
			dig(this.entity);
		} else if (g.selectedTool === "build") {
			buildFire(this.entity);
		} else if (g.selectedTool === "info") {
			if (this.entity instanceof Block) {
				selectTerrainBlock(this.entity);
			} else if (this.entity instanceof Air) {
				selectAirBlock(this.entity);
			} else if (this.entity instanceof Fixture) {
				selectTerrainBlock(this.entity);
			}
		} else if (g.selectedTool === "move") {
			const targetPos = new RocketBoots.Coords(this.x, this.y);
			if (g.selectedPersonIndex > -1) {
				const person = g.people[g.selectedPersonIndex];
				if (person) {
					person.speed = person.maxSpeed;
					person.stop().addToPath(targetPos);
				}
			}
		}
	}

	function selectAirBlock(entity) {
		g.selectedBlock = null;
		refreshInfoBoxUI(entity.gridPos, "airInfo");
	}

	function selectTerrainBlock(entity) {
		g.selectedBlock = (entity instanceof Block) ? entity : null;
		refreshInfoBoxUI(entity.gridPos, "terrainInfo");
	}

	function selectPointedPerson() {
		g.selectedBlock = null;
		let i = -1;
		if (this.entity instanceof Person) {
			i = _.findIndex(g.people, (person) => { return this.entity === person; });
		}
		selectPersonByIndex(i);
	}

	function selectPersonByIndex(i) {
		g.selectedPersonIndex = (i > -1) ? i : null;
		refreshSelectedPersonUI();
	}

	//==========================================REFRESH UI======================

	function refreshToolboxUI() {
		$('#toolbox button')
			.removeClass("selected")
			.filter('.' + g.selectedTool + 'Tool').addClass("selected");
	}

	function refreshInfoBoxUI(gridPos, id) {
		if (!gridPos || !id) {
			$("#infoBox").hide();
			return;
		}
		if (id === "airInfo") {
			$("#terrainInfo").hide();
			$("#airInfo").show();
		} else {
			$("#airInfo").hide();
			$("#terrainInfo").show();
		}
		$("#gridPos").html("X: " + gridPos.x + ", Y: " + gridPos.y);
		$("#infoBox").show().css({
			top: g.mousePos.y,
			left: g.mousePos.x
		}).data("gridx", gridPos.x).data("gridy", gridPos.y);
	}

	function refreshSelectedPersonUI() {
		const person = g.people[g.selectedPersonIndex];
		$('#selectedPerson').show().html("Selected person: " + person.name);
		// TODO: Update with more info
	}

	function refreshStatsUI() {
		let p = 0;
		let m = 0;
		_.each(g.people, (person) => {
			if (person.isDead) {
				return;
			}
			if (person.isMutant) { m++; }
			else { p++; }
		});
		$('#stats').show()
			.html("<div>Population: " + p + " / " + MAX_POPULATION + "</div><div>Mutants: " + m + "</div>");
	}

	//=====================================SETUP/PANNING========================

	function setupEvents() {
		$(canvasElt).on("mousemove", trackMousePosition);
		//$(".dig").on("click", function(event) { dig(g.selectedBlock); });
		$("#toolbox button").on("click", onClickToggleTool);
		setupPanning(canvasElt, document.getElementsByTagName("body"));
	}

	function onClickToggleTool(event) {
		let t = $(this).data("tool");
		if (g.selectedTool === t) {
			t = null;
		}
		selectTool(t);
	}

	function trackMousePosition(event) {
		g.mousePos = { x: event.pageX, y: event.pageY };
	}

	function moveStage(delta) {
		g.planet.x -= delta.x;
		g.planet.y -= delta.y;
	}

	function setupPanning(canvasElt, movingClassElt) {
		const movementThreshold = 1;
		const $movingClassElt = $(movingClassElt);
		let isDown = false;
		let didMove = false;
		let downPos = new RocketBoots.Coords();
		
		$(canvasElt).on('mousedown touchstart', function(e){
			isDown = true;
			didMove = false;
			downPos.set({x: e.pageX, y: e.pageY});
		}).on('mousemove touchmove', function(e){
			if (isDown) {
				let newPos = new RocketBoots.Coords(e.pageX, e.pageY);
				let delta = downPos.subtract(newPos);
				let distance = delta.getMagnitude();
				// TODO: Rework this so that the movementThreshold avoids movement
				// until you've moved beyond the amount (like a friction on the drag)
				// New way of movement:
				moveStage(delta);
				// Old rocketboots way: g.stage.camera.move(delta);
				downPos.set(newPos);
				didMove = (distance > movementThreshold);
				if (didMove) {
					$movingClassElt.addClass("moving");
				}
				e.preventDefault();
			}

			// Get stage coordinates from mouse position (e.offsetX, e.offsetY)
			// i.e. g.mousePos = g.stage.getPosition(e.offsetX, e.offsetY);
			// Do other stuff, show shadow of block to build
		}).on('mouseup touchend', function(e){
			if (didMove) {
				e.preventDefault();
			}
			isDown = false;
			downPos.clear();
			$movingClassElt.removeClass("moving");
		}).on('click touch', function(e){
			if (!didMove) {
				// Get stage coordinates from mouse position (e.offsetX, e.offsetY)
				// Do other stuff, possibly based on the tool you have
			}
			didMove = false;
		});
	}


}).init();