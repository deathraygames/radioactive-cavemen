(function(){


class Air {
	constructor(options) {
		this.name = options.name || "air";
		this.sprite = options.sprite || null;
		this.gridPos = options.gridPos || {x: 0, y: 0};
		this.underground = options.underground;
		this.oxygen = 1;
		this.smoke = 0;
	}
}

class Item {
	constructor(options) {
		
	}
}

class Grid extends Array  {
	constructor(options) {
		super();
		this.size = new RocketBoots.Coords(options.x, options.y);
		this.groundY = options.groundY;
		this.pixelsPerGridUnit = options.pixelsPerGridUnit;
	}
	getStageCoordsFromGridCoords(gridPos) {
		return this.getStageCoordsFromGridXY(gridPos.x, gridPos.y);
	}
	getStageCoordsFromGridXY(x, y) {
		return new RocketBoots.Coords(
			this.convertGridValueToStageValue(x), 
			this.convertGridValueToStageValue(y)
		);
	}
	getGridCoordsFromStageCoords(pos) {
		return this.getGridCoordsFromStageXY(pos.x, pos.y);
	}
	getGridCoordsFromStageXY(x, y) {
		return new RocketBoots.Coords(
			Math.floor(x / this.pixelsPerGridUnit),
			Math.floor(y / this.pixelsPerGridUnit),
		);
	}
	getGraphArray(grid) {
		if (!grid) { grid = this; }
		let graphArray = [];
		let x, y;
		for (x = 0; x < this.size.x; x++) {
			graphArray.push([]);
			for (y = 0; y < this.size.y; y++) {
				const gridSquare = grid[x][y];
				graphArray[x].push(gridSquare.getPathWeight());
			}
		}
		return graphArray;
	}
	convertGridValueToStageValue(n) {
		return (n * this.pixelsPerGridUnit);
	}
	getStageGroundY() {
		return this.groundY * this.pixelsPerGridUnit - (this.pixelsPerGridUnit / 2);
	}
	loopOver(callback) {
		let x, y;
		for (x = 0; x < this.size.x; x++) {
			for (y = 0; y < this.size.y; y++) {
				callback(this[x][y]);
			}
		}
	}
		
}

class GridSquare {
	constructor(options) {
		this.grid = options.grid;
		this.entity = options.entity;
		this.gridPos = options.gridPos || {x: 0, y: 0};
		this.sprite = options.sprite || null;
		this.explored = 1;
		this.light = 1;
	}
	getPathWeight() {
		const BLOCKED = 0, LOW = 3, MEDIUM = 2, HIGH = 1;
		let weight = BLOCKED;
		if (this.entity instanceof Block) {
			// TODO: check for non-terrain blocks (furniture, doors, etc)

		} else if (this.entity instanceof Air || this.entity instanceof Fixture) {
			const blockBelow = this.hasBlockBelow();
			const spaceAbove = this.hasSpaceAbove();

			if (this.isUnderground()) {
				if (blockBelow && spaceAbove) {
					weight = HIGH;
				} else if (blockBelow) { // crawling
					weight = MEDIUM;
				} else { // climbing
					weight = LOW;
				}
			} else { // Above ground
				if (!blockBelow) { 
					weight = BLOCKED; 
				} else if (!spaceAbove) { // crawling
					weight = MEDIUM;
				} else {
					weight = HIGH;
				}
			}
		}
		return weight;
	}
	isUnderground() {
		return (this.gridPos.y >= this.grid.groundY);
	}
	isPassable() {
		return (this.entity instanceof Air);
	}
	hasSpaceAbove() {
		const y = this.gridPos.y - 1;
		if (y <= 0) {
			return false; 
		}
		const squareAbove = this.grid[this.gridPos.x][y];
		return squareAbove.isPassable();
	}
	hasBlockBelow(x) {
		const sideCheck = (typeof x === "number");
		if (!sideCheck) { x = this.gridPos.x; }
		const y = this.gridPos.y + 1;
		if (y >= this.grid.size.y) {
			return true; 
		}
		if (x < 0 || x >= this.grid.size.x) {
			return false;
		}
		const squareBelow = this.grid[x][y];
		if (squareBelow.entity instanceof Block) {
			return true;
		}
		if (!sideCheck) {
			if (this.hasBlockBelow(x-1)) {
				return true;
			} else if (this.hasBlockBelow(x+1)) {
				return true;
			}
		}
		return false;
	}
}

class Block {
	constructor(options) {
		this.name = options.name || "generic block";
		this.sprite = options.sprite || null;
		this.gridPos = options.gridPos || {x: 0, y: 0};
		this.broken = 1;
		this.size = {x: 1, y: 1};
	}
}

class Fixture {
	constructor(options) {
		this.name = options.name || "generic fixture";
		this.sprite = options.sprite || null;
		this.textures = options.textures || [];
		this.gridPos = options.gridPos || {x: 0, y: 0};
		this.broken = 1;
		this.size = {x: 1, y: 1};
		this.textureIndex = 0;
	}
	animate() {
		if (this.textures.length > 1) {
			this.textureIndex++;
			if (this.textureIndex >= this.textures.length) {
				this.textureIndex = 0;
			}
			this.sprite.texture = this.textures[this.textureIndex];
		}
	}
}

class Person {
	constructor(options) {
		//this.gridPos = options.gridPos || {x: 0, y: 0};
		this.grid = options.grid; // array of arrays, with `size` coord
		this.people = options.people;
		this.path = []; // Array of pixel coordinates
		this.textures = options.textures;
		this.sprite = options.sprite || null;
		this.remove = options.remove;
		this.name = this.getRandomName();
		this.task = null;
		this.target = null;
		this.speed = 2;
		this.maxSpeed = 10;
		this.energy = 0;
		this.maxEnergy = 1000;
		this.maxHealth = 800;
		this.health = this.maxHealth;
		this.radiation = 0;
		this.maxRadiation = 2000;
		this.decay = 2000;
		this.fearCooldown = 0;
		this.isResting = false;
		this.isDead = false;
		this.isMutant = false;
		this.isFemale = false;
		this.isMale = false;
		this.setGender();
	}
	getRandomName() {
		const dice = new RocketBoots.Dice();
		const syllables = ["ax", "ad", "be", "cax", "dag", "et", "fuz", "glud", 
			"hah", "ig", "jun", "kim", "lor", "leo", "mad", "max", "no", "ot",
			"peg", "qua", "ra", "sen", "tyr", "un", "ven", "won", "xi", "yo", 
			"zep", "zab"
		];
		let n = dice.roll(2) + dice.roll(2);
		let name = "";
		while (n--) {
			name += dice.selectRandom(syllables);
		}
		return name.charAt(0).toUpperCase() + name.slice(1);
	}
	setGender() {
		const dice = new RocketBoots.Dice();
		this.isFemale = (dice.flip()) ? true : false;
		this.isMale = !this.isFemale;
	}
	addToPath(targetPos, dontPathfind) {  // requires astar lib
		targetPos = new RocketBoots.Coords(targetPos);
		if (dontPathfind) {
			this.path.push(targetPos);
			return this;
		}
		const gridPos = this.grid.getGridCoordsFromStageCoords(this.getPos());
		const targetGridPos = this.grid.getGridCoordsFromStageCoords(targetPos);
		const graphArray = this.grid.getGraphArray();
		const result = this.getPathFindingResult(graphArray, gridPos, targetGridPos);
		_.each(result, (gridNode) => {
			const pos = this.grid.getStageCoordsFromGridXY(gridNode.x, gridNode.y);
			this.path.push(pos);
		});
		return this;
	}
	getPathFindingResult(graphArray, startCoord, endCoord) { // requires astar lib
		const graph = new Graph(graphArray);
		const start = graph.grid[startCoord.x][startCoord.y];
		const end = graph.grid[endCoord.x][endCoord.y];
		return astar.search(graph, start, end);
	}
	act(delta) {
		if (this.isDead) { 
			this.decay--;
			return this; 
		}
		if (this.isResting || this.energy <= 0) {
			this.stop().rest(delta);
		} else if (this.path.length > 0) {
			this.moveAlongPath(delta);
		}
		return this;
	}
	moveAlongPath(delta) {
		const pos = this.getPos();
		// TODO: Make sure that graph isn't blocked
		if (this.path.length <= 0) {
			this.rest(delta);
			return false;
		}
		const nextPos = this.path[0];
		if (!(nextPos instanceof RocketBoots.Coords)) {
			console.error("!");
		}
		const stepDistance = delta * (this.speed / 5);
		this.fatigue(stepDistance);
		const distance = pos.getDistance(nextPos);
		if (distance < stepDistance) {
			this.sprite.x = nextPos.x;
			this.sprite.y = nextPos.y;
			this.sprite.rotation = 0;
			this.path.shift();
		} else {
			const nextPosUnit = pos.getUnitVector(nextPos).multiply(stepDistance);
			const dice = new RocketBoots.Dice();
			const bopY = dice.roll1d(3) - 2;
			const rotationDivider = (this.isMutant) ? 5 : 10;
			if (dice.roll1d(10) === 1) {
				this.sprite.rotation = (dice.roll1d(3) - 2) / rotationDivider;
			} else {
				//this.sprite.rotation = 0;
			}
			this.sprite.x += nextPosUnit.x;
			this.sprite.y += nextPosUnit.y + bopY;
		}
		this.sprite.texture = this.textures.walking;
	}
	stop() {
		this.path.length = 0;
		return this;
	}
	fatigue(delta) {
		const amount = -1 * Math.ceil(1 * delta)
		this.energy += amount;
		//console.log("fatigue", amount, this.energy);
		if (this.energy < 0) { this.energy = 0; }
	}
	rest(delta) {
		if (this.isDead) { return 0; }
		const amount = Math.ceil(10 * delta)
		this.energy += amount;
		//console.log("rest", amount, this.energy);
		if (this.energy > this.maxEnergy) { this.energy = this.maxEnergy; }
		// this.sprite.rotation = Math.PI / 2;
		this.sprite.texture = this.textures.resting;
		this.sprite.rotation = 0;
	}
	getPos() {
		return new RocketBoots.Coords(this.sprite.x, this.sprite.y);
	}
	getGridPos() {
		const pos = this.getPos();
		return this.grid.getGridCoordsFromStageCoords(pos);
	}
	getGridSquare() {
		const gridPos = this.getGridPos();
		return this.grid[gridPos.x][gridPos.y];
	}
	addRandomPosToPath() {
		const dice = new RocketBoots.Dice();
		const x = dice.getRandomIntegerBetween(0, (this.grid.size.x - 1));
		const y = dice.getRandomIntegerBetween(0, (this.grid.size.y - 1));
		if (this.grid[x][y].getPathWeight() > 0) {
			const pos = this.grid.getStageCoordsFromGridXY(x, y);
			this.addToPath(pos);
		}
	}
	setRandomSpeed() {
		const dice = new RocketBoots.Dice();
		this.speed = dice.roll1d(this.maxSpeed);
	}
	think() {
		if (this.isDead) {
			return "RIP";
		}
		const restoreEnergy = (this.fearCooldown <= 0) ? this.maxEnergy : this.maxEnergy/2;
		if (this.energy <= 0) {
			this.isResting = true;
			return "I need to rest";
		} else if (this.isResting && this.energy >= restoreEnergy) {
			this.isResting = false;
			return "Done resting";
		}


		if (!this.isMutant && this.fearCooldown === 0) {
			const nearbyMutant = this.findPersonNearby("mutant", 3);
			if (nearbyMutant) {
				this.speed = this.maxSpeed;
				this.addRandomPosToPath();
				this.fearCooldown = 1000;
				return "Oh no, a mutant!";
			}
		}
		if (this.fearCooldown > 0) { this.fearCooldown--; }

		if (this.task) {
			return "Do stuff!";
		} else if (this.path.length > 0) {
			return "I have a path";
		} else { // No task and no path, time to find something to do...
			const dice = new RocketBoots.Dice();
			const r = (this.isMutant) ? 0 : dice.roll1d(3);
			if (r === 1) {
				// Find person
				const nearbyPerson = this.findNearestPerson(false);
				if (nearbyPerson) {
					const personPos = nearbyPerson.getPos();
					this.addToPath(personPos);
					return "Finding a friend";
				}
			} else if (r === 2) {
				const nearbyFire = this.findThingNearby("fire", 10);
				if (nearbyFire) {
					const firePos = this.grid.getStageCoordsFromGridCoords(nearbyFire.gridPos);
					this.addToPath(firePos);
					return "Going to a fire";
				}
			}
			this.setRandomSpeed();
			this.addRandomPosToPath();
			return "Go for a stroll";
		}
		return "?";
	}
	findThingNearby(name, gridRadius) {
		const gridPos = this.getGridPos();
		const pos = this.getPos();
		let nearestRadius = Infinity;
		let found = null;
		this.grid.loopOver((gridSquare) => {
			if (gridSquare.entity.name !== name) {
				return;
			}
			const distance = gridPos.getDistance(gridSquare.gridPos);
			if (distance <= nearestRadius) {
				found = gridSquare.entity;
				nearestRadius = distance;
			}
		});
		return found;
	}
	findPersonNearby(name, gridRadius) {
		const radius = this.grid.convertGridValueToStageValue(gridRadius);
		const pos = this.getPos();
		let found = null;
		_.each(this.people, (person) => {
			if (person.name !== name) {
				return;
			}
			const distance = pos.getDistance(person.getPos());
			if (distance <= radius) {
				found = person;
			}
		});
		return found;
	}
	findNearestPerson(includeMutants) {
		const pos = this.getPos();
		let nearestRadius = Infinity;
		let found = null;
		_.each(this.people, (person) => {
			if (person.isMutant && !includeMutants) {
				return;
			}
			const distance = pos.getDistance(person.getPos());
			if (distance <= nearestRadius) {
				found = person;
				nearestRadius = distance;
			}
		});
		return found;

	}
	absorbRadiation(delta) {
		let gridSquare = this.getGridSquare();
		let amount = (gridSquare.isUnderground()) ? 0 : 1;
		if (this.isDead) { return 0; }
		this.radiation += amount;
		if (this.radiation > this.maxRadiation) {
			if (this.isMutant) {
				this.damage(amount);
			} else {
				this.mutate();
			}
		}
	}
	mutate() {
		this.isMutant = true;
		this.name = "mutant";
		this.textures.walking = this.textures.mutant;
		this.textures.resting = this.textures.mutant;
		this.sprite.texture = this.textures.mutant;
		this.maxEnergy *= 3;
		this.energy = this.maxEnergy;
		this.maxSpeed *= 4;
	}
	damage(amount) {
		this.health -= amount;
		if (this.health < 0) {
			this.die();
		}
	}
	die() {
		this.isDead = true;
		this.textures.walking = this.textures.dead;
		this.textures.resting = this.textures.dead;
		this.sprite.texture = this.textures.dead;
	}
}



// Expose
window.Grid = Grid;
window.GridSquare = GridSquare;
window.Air = Air;
window.Block = Block;
window.Fixture = Fixture;
window.Person = Person;

})();