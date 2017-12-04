
// engine version commit 7375ed

function load_image (url, callback) {
	var image = new Image();
	image.onload = callback.bind(undefined, image);
	image.src = url;
}

function load_all_images (images, callback) {
	var keys = Object.keys(images);
	var count_loaded = 0;
	for (var i = 0; i < keys.length; i++) {
		load_image(images[keys[i]], (function (key, image) {
			images[key] = image;

			count_loaded++;
			if (count_loaded === keys.length)
				callback();
		}).bind(undefined, keys[i]));
	}
}

function point_offset(angle, dist) {
	return { px: dist * Math.cos(Math.PI * angle / 180), py: dist * Math.sin(Math.PI * angle / 180), };
}

function point_dist(px, py) {
	return (px ** 2 + py ** 2) ** 0.5;
}

function points_dist(p1, p2) {
	return ((p1.px - p2.px) ** 2 + (p1.py - p2.py) ** 2) ** 0.5;
}

function point_normal(px, py) {
	var dist = (px ** 2 + py ** 2) ** 0.5;
	if (dist === 0)
		return { px: 0, py: 0 };
	return { px: px / dist, py: py / dist, };
}

function d2_point_offset(angle, px, py) {
	return {
		px: px * Math.cos(Math.PI * angle / 180) - py * Math.sin(Math.PI * angle / 180),
		py: py * Math.cos(Math.PI * angle / 180) + px * Math.sin(Math.PI * angle / 180),
	};
}

function point_angle(fromx, fromy, tox, toy) {
	var dx = tox - fromx;
	var dy = toy - fromy;
	var angle = Math.atan2(dy, dx);
	// console.log("angle: ", angle / Math.PI * 180);
	return angle / Math.PI * 180;
}

function GameSystem(canvas, images) {
	this.canvas = canvas;
	canvas.game_system = this;
	this.images = images;

	this.entities = [];
	this.entities_to_add = [];
	this.entities_to_remove = [];

	this.game_systems = {};
	this.particle_systems = {};


	this.debug_time = { game_update_time: 0, game_draw_time: 0, game_entity_draw_time: {}, };
	this.debug_time_timer = 0;

	this.keystate = {
		W: false,
		A: false,
		S: false,
		D: false,
		' ': false,
		shift: false,
		ctrl: false,
		alt: false,
	};
	this.mouse1_state = false;
	this.mouse_position = { px: 0, py: 0 };

	document.addEventListener('keydown', (function (e) {
		e = e || window.event;
		e.preventDefault();
		var charcode = String.fromCharCode(e.keyCode);
		this.keystate[charcode] = true;
		this.keystate.shift = !!e.shiftKey;
		this.keystate.ctrl = !!e.ctrlKey;
		this.keystate.alt = !!e.altKey;
		// console.log('keydown: ', charcode);
	}).bind(this));

	document.addEventListener('keyup', (function (e) {
		e = e || window.event;
		e.preventDefault();
		var charcode = String.fromCharCode(e.keyCode);
		this.keystate[charcode] = false;
		this.keystate.shift = !!e.shiftKey;
		this.keystate.ctrl = !!e.ctrlKey;
		this.keystate.alt = !!e.altKey;
		// console.log('keyup: ', charcode);
	}).bind(this));

	var self = this;
	this.canvas.addEventListener('mousedown', function (e) {
		var x = e.x - this.getBoundingClientRect().left;
		var y = e.y - this.getBoundingClientRect().top;
		self.mouse_position = { px: x, py: y };
		self.mouse1_state = true;
		// console.log("mousedown: ", x, y);
	});
	this.canvas.addEventListener('mouseup', function (e) {
		var x = e.x - this.getBoundingClientRect().left;
		var y = e.y - this.getBoundingClientRect().top;
		self.mouse_position = { px: x, py: y };
		self.mouse1_state = false;
		// console.log("mouseup: ", x, y);
	});
	this.canvas.addEventListener('mousemove', function (e) {
		var x = e.x - this.getBoundingClientRect().left;
		var y = e.y - this.getBoundingClientRect().top;
		self.mouse_position = { px: x, py: y };
		// console.log("mousemove: ", x, y);
	});
}
GameSystem.prototype.step_game_frame = function(ctx) {
	var self = this;
	// console.log('step');

	this.debug_time_timer++;
	if (this.debug_time_timer >= 120) {
		this.debug_time_timer = 0;
		// Object.keys(this.debug_time.game_entity_draw_time).forEach(function (k) { self.debug_time.game_entity_draw_time[k] /= 120; });
		// console.log("draw time by: ", this.debug_time.game_entity_draw_time); // DEBUG_TIME
		// console.log("frame time; update:", this.debug_time.game_update_time / 120, "draw:", this.debug_time.game_draw_time / 120); // DEBUG_TIME
		this.debug_time.game_update_time = 0;
		this.debug_time.game_draw_time = 0;
		this.debug_time.game_entity_draw_time = {};
	}

	// var start = new Date().getTime(); // DEBUG_TIME
	this.update();
	// this.debug_time.game_update_time += new Date().getTime() - start; // DEBUG_TIME
	
	// start = new Date().getTime(); // DEBUG_TIME
	this.draw(ctx);
	// this.debug_time.game_draw_time += new Date().getTime() - start; // DEBUG_TIME
};
GameSystem.prototype.update = function () {

	for (var i = 0; i < this.entities_to_remove.length; i++) {
		var index = this.entities.indexOf(this.entities_to_remove[i]);
		if (index >= 0)
			this.entities.splice(index, 1);
	}
	this.entities_to_remove = [];

	for (var i = 0; i < this.entities_to_add.length; i++)
		this.entities.push(this.entities_to_add[i]);
	this.entities_to_add = [];

	try {
		for (var i = 0; i < this.entities.length; i++) {
			this.entities[i].update(this);
		}
	} catch (e) {
		console.error('exception during update:', e.message);
		console.error('exception stack:', e.stack);
	}

	var keys = Object.keys(this.game_systems);
	for (var i = 0; i < keys.length; i++) {
		this.game_systems[keys[i]].update(this);
	}

	var keys = Object.keys(this.particle_systems);
	for (var i = 0; i < keys.length; i++) {
		this.particle_systems[keys[i]].update(this);
	}
};
GameSystem.prototype.draw = function (ctx) {
	ctx.clearRect(0, 0, 640, 480);

	ctx.fillStyle = 'rgb(0, 0, 0)';
	ctx.fillRect(0, 0, 640, 480);

	var entities_to_draw = this.entities.slice();
	var game_systems_to_draw = Object.values(this.game_systems);
	entities_to_draw.sort(function (a, b) {
		return a.z_index - b.z_index;
	});
	game_systems_to_draw.sort(function (a, b) {
		return a.z_index - b.z_index;
	});

	for (var i = 0; i < game_systems_to_draw.length; i++) {
		if (game_systems_to_draw[i].z_index < 0) {
			// var start = new Date().getTime(); // DEBUG_TIME
			game_systems_to_draw[i].draw(ctx);
			// this.debug_time.game_entity_draw_time[this.particle_systems[keys[i]].class_name] = // DEBUG_TIME
				// (this.debug_time.game_entity_draw_time[this.particle_systems[keys[i]].class_name] || 0) + new Date().getTime() - start; // DEBUG_TIME
		}
	}

	for (var i = 0; i < entities_to_draw.length; i++) {
		// var start = new Date().getTime(); // DEBUG_TIME
		entities_to_draw[i].draw(ctx);
		// this.debug_time.game_entity_draw_time[this.entities[i].class_name] = // DEBUG_TIME
			// (this.debug_time.game_entity_draw_time[this.entities[i].class_name] || 0) + new Date().getTime() - start; // DEBUG_TIME
	}

	var keys = Object.keys(this.particle_systems);
	for (var i = 0; i < keys.length; i++) {
		// var start = new Date().getTime(); // DEBUG_TIME
		this.particle_systems[keys[i]].draw(ctx);
		// this.debug_time.game_entity_draw_time[this.particle_systems[keys[i]].class_name] = // DEBUG_TIME
			// (this.debug_time.game_entity_draw_time[this.particle_systems[keys[i]].class_name] || 0) + new Date().getTime() - start; // DEBUG_TIME
	}

	for (var i = 0; i < game_systems_to_draw.length; i++) {
		if (game_systems_to_draw[i].z_index >= 0) {
			// var start = new Date().getTime(); // DEBUG_TIME
			game_systems_to_draw[i].draw(ctx);
			// this.debug_time.game_entity_draw_time[this.particle_systems[keys[i]].class_name] = // DEBUG_TIME
				// (this.debug_time.game_entity_draw_time[this.particle_systems[keys[i]].class_name] || 0) + new Date().getTime() - start; // DEBUG_TIME
		}
	}

	for (var i = 0; i < this.entities.length; i++) {
		this.entities[i].draw_ui(ctx);
	}
};

GameSystem.prototype.query_entities = function(type) {
	var found = [];
	for (var i = 0; i < this.entities.length; i++) {
		if (this.entities[i] instanceof type) {
			found.push(this.entities[i]);
		}
	}

	return found;
};

GameSystem.prototype.query_entities_by_tag = function(type, tag_type) {
	var found = [];
	for (var i = 0; i < this.entities.length; i++) {
		if (this.entities[i] instanceof type) {
			if (this.entities[i].get_tag(tag_type) !== undefined) {
				found.push(this.entities[i]);
			}
		}
	}

	return found;
};

GameSystem.prototype.find_near = function(me, type, dist) {
	var found = [];
	for (var i = 0; i < this.entities.length; i++) {
		var ent = this.entities[i];
		if (ent instanceof type) {
			if (Math.abs(ent.px - me.px) < dist && Math.abs(ent.py - me.py) < dist &&
				Math.pow(Math.pow(ent.px - me.px, 2) + Math.pow(ent.py - me.py, 2), 0.5) < dist) {
				found.push(ent);
			}
		}
	}

	return found;
};

GameSystem.prototype.find_colliding = function(me, type, dist) {
	var found = [];
	for (var i = 0; i < this.entities.length; i++) {
		var ent = this.entities[i];
		if (ent instanceof type) {
			var hit_radius = dist + ent.collision_radius;
			if (Math.abs(ent.px - me.px) < hit_radius && Math.abs(ent.py - me.py) < hit_radius &&
				Math.pow(Math.pow(ent.px - me.px, 2) + Math.pow(ent.py - me.py, 2), 0.5) < hit_radius) {
				found.push(ent);
			}
		}
	}

	return found;
};


function Entity(game) {
	this.sub_entities = [];
	this.ui_entities = [];
	this.entity_tags = [];
	this.visible = true;
}
Entity.prototype.class_name = 'Entity';
Entity.prototype.z_index = 0;
Entity.prototype.update = function(game) {
	for (var i = 0; i < this.sub_entities.length; i++) {
		this.sub_entities[i].update(game);
	}
	for (var i = this.entity_tags.length - 1; i >= 0; i--) {
		if (this.entity_tags[i].timer !== undefined) {
			this.entity_tags[i].timer--;
			if (this.entity_tags[i] <= 0) {
				this.entity_tags.splice(i, 1);
			}
		}
	}
};
Entity.prototype.draw = function(ctx) {
	if (this.visible) {
		for (var i = 0; i < this.sub_entities.length; i++) {
			this.sub_entities[i].draw(ctx);
		}
	}
};
Entity.prototype.draw_ui = function(ctx) {
	if (this.visible) {
		for (var i = 0; i < this.ui_entities.length; i++) {
			this.ui_entities[i].draw(ctx);
		}
	}
};
Entity.prototype.get_tag = function(type) {
	for (var i = 0; i < this.entity_tags.length; i++) {
		if (this.entity_tags[i] instanceof type) {
			return this.entity_tags[i];
		}
	}
	return undefined;
};

function ScreenEntity(game, px, py, width, height, image) {
	Entity.call(this, game);
	this.px = px;
	this.py = py;
	this.angle = 0;
	this.frame = 0;
	this.max_frame = 1;
	this.width = width;
	this.height = height;
	this.image = image;

	this.rotation = 0;
	this.angle_granularity = 15;
}
ScreenEntity.prototype = Object.create(Entity.prototype);
ScreenEntity.prototype.constructor = ScreenEntity;
ScreenEntity.prototype.class_name = 'ScreenEntity';
ScreenEntity.prototype.update = function(game) {
	Entity.prototype.update.call(this, game);
	if (this.rotation) {
		this.angle += this.rotation;
		this.angle %= 360;
	}
};
ScreenEntity.prototype.draw = function(ctx) {
	// ctx.drawImage(this.image, this.px - this.width / 2, this.py - this.height / 2, this.width, this.height);
	if (this.visible) {
		ctx.save();

		ctx.translate(this.px, this.py);
		ctx.rotate(Math.PI * (Math.floor(this.angle / this.angle_granularity) * this.angle_granularity) / 180);

		for (var i = 0; i < this.sub_entities.length; i++) {
			if (this.sub_entities[i].z_index < this.z_index)
				this.sub_entities[i].draw(ctx);
		}

		ctx.drawImage(this.image,
			this.frame * (this.image.width / this.max_frame), 0, this.image.width / this.max_frame, this.image.height,
			0 - this.width / 2, 0 - this.height / 2, this.width, this.height);

		for (var i = 0; i < this.sub_entities.length; i++) {
			if (this.sub_entities[i].z_index >= this.z_index)
				this.sub_entities[i].draw(ctx);
		}

		ctx.restore();
	}
};
ScreenEntity.prototype.draw_ui = function(ctx) {
	if (this.visible) {
		ctx.save();
		ctx.translate(this.px, this.py);
		for (var i = 0; i < this.ui_entities.length; i++) {
			this.ui_entities[i].draw(ctx);
		}
		ctx.restore();
	}
};



function ParticleEffectSystem(game, config) {
	ScreenEntity.call(this, game);
	this.fill_style = config.fill_style;
	this.particle_image = config.particle_image || game.images.particle_effect_generic;

	this.particles = [];

	this.width = 8;
	this.height = 8;
	// this.frame_width = 8;
	// this.max_frame = config.max_frame || (this.width / this.frame_width);
	this.max_frame = config.max_frame || (this.particle_image.width / this.width);
	this.frame_step = config.frame_step || 0;

	this.particle_sx = config.particle_sx || 0;
	this.particle_sy = config.particle_sy || 0;

	this.particle_width = config.particle_width || config.particle_size || 16;
	this.particle_height = config.particle_height || config.particle_size || 16;

	this.particle_deflate = config.particle_deflate;
	this.particle_longevity = config.particle_longevity || 0.05;
	this.particle_respawn = config.particle_respawn || 0;
	this.particle_base_timer = config.particle_base_timer || 4;
	this.particle_max_timer = config.particle_max_timer || 0;

	this.dynamic_images = config.dynamic_images;
	this.static_images = config.static_images;

	if (this.fill_style !== undefined && !this.dynamic_images && !this.static_images)
		this.particle_image = this.render();
}
ParticleEffectSystem.prototype = Object.create(ScreenEntity.prototype);
ParticleEffectSystem.prototype.constructor = ParticleEffectSystem;
ParticleEffectSystem.prototype.class_name = 'ParticleEffectSystem';
ParticleEffectSystem.prototype.render = function() {
	var buffer_canvas = document.createElement('canvas');
	buffer_canvas.width = this.particle_image.width;
	buffer_canvas.height = this.particle_image.height;
	var buffer_context = buffer_canvas.getContext('2d');
	buffer_context.imageSmoothingEnabled = false;

	buffer_context.fillStyle = this.fill_style;
	buffer_context.fillRect(0,0, buffer_canvas.width, buffer_canvas.height);

	buffer_context.globalCompositeOperation = "destination-atop";
	buffer_context.drawImage(this.particle_image, 0,0);
	return buffer_canvas;
};
ParticleEffectSystem.prototype.add_particle = function(px, py, speed, frame, angle) {
	var sx = this.particle_sx + ((Math.random() - 0.5) * speed) ** 2 - ((Math.random() - 0.5) * speed) ** 2;
	var sy = this.particle_sy + ((Math.random() - 0.5) * speed) ** 2 - ((Math.random() - 0.5) * speed) ** 2;

	if (angle === undefined)
		angle = Math.random() * 360;
	if (frame === undefined) {
		if (this.static_images) {
			frame = Math.floor(Math.random() * this.max_frame);
		} else {
			frame = 0;
		}
	}

	this.particles.push({
		px: px,
		py: py,
		sx: sx,
		sy: sy,
		sr: Math.random() - 0.5,
		angle: angle,
		frame: frame,
		timer: this.particle_base_timer,
		// timer: this.particle_base_timer + Math.floor(Math.random() * (this.particle_max_timer - this.particle_base_timer + 1)),
	});
};
ParticleEffectSystem.prototype.add_image_particle = function(image, width, height, px, py, speed) {
	var sx = this.particle_sx + ((Math.random() - 0.5) * speed) ** 2 - ((Math.random() - 0.5) * speed) ** 2;
	var sy = this.particle_sy + ((Math.random() - 0.5) * speed) ** 2 - ((Math.random() - 0.5) * speed) ** 2;

	var sourcex = image.width * (Math.random() * 0.5);
	var sourcey = image.height * (Math.random() * 0.5);
	var width = width * (Math.random() * 0.25 + 0.25);
	var height = height * (Math.random() * 0.25 + 0.25);

	// var offsetx = Math.random() * width - width / 2;
	// var offsety = Math.random() * height - height / 2;

	this.particles.push({
		image: image,
		sourcex: sourcex,
		sourcey: sourcey,
		width: width,
		height: height,
		px: px,
		py: py,
		sx: sx,
		sy: sy,
		sr: Math.random() - 0.5,
		angle: Math.random() * 360,
		frame: 0,
	});
};
ParticleEffectSystem.prototype.update = function(game) {
	for (var i = this.particles.length - 1; i >= 0; i--) {
		this.particles[i].px += this.particles[i].sx;
		this.particles[i].py += this.particles[i].sy;
		this.particles[i].angle += this.particles[i].sr;
		if (this.frame_step)
			this.particles[i].frame = (this.particles[i].frame + this.frame_step) % this.max_frame;

		if (Math.random() < this.particle_longevity) {
			if (this.static_images) {
				this.particles[i].timer--;
				if (this.particles[i].timer <= 0) {
					if (Math.random() < this.particle_respawn) {
						this.particles[i].timer = 4;
					} else {
						this.particles.splice(i, 1);
					}
				}
			} else {
				this.particles[i].frame++;
				if (this.particles[i].frame >= this.max_frame) {
					if (Math.random() < this.particle_respawn) {
						this.particles[i].frame = 0;
					} else {
						this.particles.splice(i, 1);
					}
				}
			}
		}
	}
};
ParticleEffectSystem.prototype.draw = function(ctx) {
	if (this.visible) {
		// console.log("drawing ", this.particles.length, "particles");
		for (var i = 0; i < this.particles.length; i++) {
			var p = this.particles[i];
			ctx.save();

			ctx.translate(p.px, p.py);
			ctx.rotate(Math.PI * (Math.floor(p.angle / 15) * 15) / 180);
			var width = this.particle_width;
			var height = this.particle_height;
			if (this.particle_deflate) {
				// console.log("debug", this.particle_deflate);
				var multiplier = (this.max_frame * this.particle_deflate - p.frame) / this.max_frame;
				width *= multiplier;
				height *= multiplier;
			}
			// var width = this.particle_width * ((6 - p.frame) / 4);
			// var height = this.particle_height * ((6 - p.frame) / 4);
			if (this.dynamic_images) {
				ctx.drawImage(p.image, 
					p.sourcex, p.sourcey, p.width, p.height,
					// this.width * p.frame, 0, this.width, this.height,
					0 - p.width / 2, 0 - p.height / 2, p.width, p.height);
			// } else if (this.static_images) {
			// 	ctx.drawImage(this.particle_image, 
			// 		this.width * p.frame, 0, this.width, this.height,
			// 		0 - width / 2, 0 - height / 2, width, height);
			// } else if (this.fill_style !== undefined) {
			// 	ctx.drawImage(this.buffer_canvas, 
			// 		this.width * p.frame, 0, this.width, this.height,
			// 		0 - width / 2, 0 - height / 2, width, height);
			} else {
				ctx.drawImage(this.particle_image, 
					this.width * p.frame, 0, this.width, this.height,
					0 - width / 2, 0 - height / 2, width, height);
			}

			ctx.restore();
		}
	}
};








function PathEntity(game, px, py, width, height, image, path) {
	ScreenEntity.call(this, game, px, py, width, height, image);

	// console.log('debug path: ', path);
	this.loop_path = false;

	this.path = path;
	this.path_index = 0;
	this.current_action = undefined;
}
PathEntity.prototype = Object.create(ScreenEntity.prototype);
PathEntity.prototype.constructor = PathEntity;
PathEntity.prototype.class_name = 'PathEntity';
PathEntity.prototype.trigger_path_action = function(game, action) {
	if (action.delete !== undefined) {
		game.entities_to_remove.push(this);
	}

	if (action.px !== undefined) {
		if (action.timeout !== undefined) {
			action.sx = (action.px - this.px) / action.timeout;
			action.sy = (action.py - this.py) / action.timeout;
			this.timer = action.timeout;
		} else {
			var dist = ((action.px - this.px) ** 2 + (action.py - this.py) ** 2) ** 0.5;
			var normalx = (action.px - this.px) / dist;
			var normaly = (action.py - this.py) / dist;
			action.sx = normalx * action.speed;
			action.sy = normaly * action.speed;
			this.timer = dist / action.speed;
		}
	} else {
		if (action.angle !== undefined) {
			this.angle = action.angle;
			if (action.speed !== undefined) {
				action.sx = Math.cos(action.angle / 180 * Math.PI) * action.speed;
				action.sy = Math.sin(action.angle / 180 * Math.PI) * action.speed;
			}
		}

		if (action.timeout !== undefined) {
			this.timer = action.timeout;
		} else {
			this.timer = undefined;
		}
	}

	if (action.repeat !== undefined) {
		if (this.action_repeat === undefined || this.action_repeat <= 0) {
			this.action_repeat = action.repeat;
		}
	} else {
		this.action_repeat = undefined;
	}


	if (action.sx === undefined)
		action.sx = 0;
	if (action.sy === undefined)
		action.sy = 0;



	if (action.spawn) {
		for (var i = 0; i < action.spawn.length; i++) {
			// console.log("debug path: ", action.spawn[i].path);
			var bullet = new EnemyBullet(game, this.px, this.py, action.spawn[i].path, action.spawn[i].image);
			bullet.angle = this.angle;
			game.entities_to_add.push(bullet);
		}
	}

	if (action.spawn_entity) {
		for (var i = 0; i < action.spawn_entity.length; i++) {
			// console.log("debug path: ", action.spawn_entity[i].path);
			var instruction = action.spawn_entity[i];

			var args = instruction.args.slice();
			args.unshift(this.py + (instruction.py || 0));
			args.unshift(this.px + (instruction.px || 0));
			args.unshift(game);

			var object = Object.create(instruction.class.prototype);
			instruction.class.apply(object, args);
			game.entities_to_add.push(object);
		}
	}

	if (action.call) {
		for (var i = 0; i < action.call.length; i++) {
			var args = action.call[i].args || [];
			args = args.slice(0);
			args.unshift(game);
			this[action.call[i].method].apply(this, args);
		}
	}

	if (action.call_system) {
		for (var i = 0; i < action.call_system.length; i++) {
			var args = action.call_system[i].args || [];
			args = args.slice(0);
			args.unshift(game);
			game.game_systems[action.call_system[i].system][action.call_system[i].method].apply(
					game.game_systems[action.call_system[i].system], args);
		}
	}
};
PathEntity.prototype.update = function(game) {
	ScreenEntity.prototype.update.call(this, game);
	if (this.path === undefined) {
		// do nothing
	} else if (this.current_action === undefined) {
		if (this.path.length > this.path_index) {
			this.current_action = this.path[this.path_index];
			this.path_index++;
			this.trigger_path_action(game, this.current_action);
		} else if (this.loop_path) {
			this.path_index = 0;
			this.current_action = this.path[this.path_index];
			this.path_index++;
			this.trigger_path_action(game, this.current_action);
		} else {
			game.entities_to_remove.push(this);
		}
	} else {
		if (this.current_action.fda !== undefined) {
			this.current_action.da *= this.current_action.fda;
		}
		if (this.current_action.da !== undefined) {
			this.angle += this.current_action.da;
			// this.angle = this.current_action.angle;
			if (this.current_action.speed) {
				this.current_action.sx = Math.cos(this.angle / 180 * Math.PI) * this.current_action.speed;
				this.current_action.sy = Math.sin(this.angle / 180 * Math.PI) * this.current_action.speed;
			}
		}

		if (this.current_action.trail) {
			if (Math.random() < this.current_action.trail.thickness) {
				game.particle_systems[this.current_action.trail.type].add_particle(this.px, this.py, this.current_action.trail.speed || 2);
			}
		}

		this.px += this.current_action.sx;
		this.py += this.current_action.sy;

		if (this.timer !== undefined) {
			this.timer--;
			if (this.timer <= 0) {
				if (this.action_repeat !== undefined && this.action_repeat > 1) {
					this.timer = this.current_action.timeout;
					this.trigger_path_action(game, this.current_action);
					this.action_repeat--;
				} else {
					this.current_action = undefined;
				}
			}
		}
	}
};




function CollidingEntity(game, px, py, width, height, image, path) {
	PathEntity.call(this, game, px, py, width, height, image, path);
}
CollidingEntity.prototype = Object.create(PathEntity.prototype);
CollidingEntity.prototype.constructor = CollidingEntity;
CollidingEntity.prototype.class_name = 'CollidingEntity';
CollidingEntity.prototype.collision_radius = 10;
CollidingEntity.prototype.collision_map = [];

CollidingEntity.prototype.update = function(game) {
	PathEntity.prototype.update.call(this, game);
	this.check_collision(game);
};
CollidingEntity.prototype.check_collision = function(game) {
	for (var i = 0; i < this.collision_map.length; i++) {
		// console.log("debug: ", this.collision_radius + this.collision_map[i].class.prototype.collision_radius);
		var colliding = game.find_colliding(this, this.collision_map[i].class, this.collision_radius);
		// var colliding = game.find_near_dynamic(this, this.collision_map[i].class, this.collision_radius);
		for (var k = 0; k < colliding.length; k++) {
			this[this.collision_map[i].callback](game, colliding[k]);
		}
	}
};




function DebugSystem(game) {
	Entity.call(this, game);

	this.debug_text_entries = [];

	this.debug_rays = [];
	this.next_debug_rays = [];
	this.debug_squares = [];
	this.next_debug_squares = [];
}
DebugSystem.prototype = Object.create(Entity.prototype);
DebugSystem.prototype.update = function(game) {
	this.debug_rays = this.next_debug_rays;
	this.next_debug_rays = [];
	this.debug_squares = this.next_debug_squares;
	this.next_debug_squares = [];

	for (var i = 0; i < this.debug_text_entries.length; i++) {
		if (this.debug_text_entries[i]) {
			this.debug_text_entries[i].update(game);
		}
	}
};
DebugSystem.prototype.draw = function(ctx) {
	if (this.visible) {
		for (var i = 0; i < this.debug_text_entries.length; i++) {
			this.draw_debug_text(ctx, this.debug_text_entries[i], i + 1);
		}

		for (var i = 0; i < this.debug_rays.length; i++) {
			this.draw_debug_ray(ctx, this.debug_rays[i]);
		}

		for (var i = 0; i < this.debug_squares.length; i++) {
			this.draw_debug_square(ctx, this.debug_squares[i]);
		}
	}
};
DebugSystem.prototype.draw_debug_text = function(ctx, entry, i) {
	ctx.font = '16pt monospace';
	ctx.fillStyle = entry.color || '#f00';

	ctx.fillText(entry.text, 0, i * 16);
	var offsetx = ctx.measureText(entry.text).width;

	for (var k = 0; k < entry.rays.length; k++) {
		this.draw_debug_ray(ctx, {
			start: { px: offsetx, py: i * 16 - 8 },
			end: entry.rays[k],
			color: entry.color,
		});
	}
};
DebugSystem.prototype.draw_debug_ray = function(ctx, ray) {
	ctx.strokeStyle = ray.color || '#f00';
	ctx.lineWidth = ray.thickness || 1;
	
	ctx.beginPath();
	ctx.moveTo(ray.start.px, ray.start.py);
	ctx.lineTo(ray.end.px, ray.end.py);

	var angle = point_angle(ray.start.px, ray.start.py, ray.end.px, ray.end.py);
	var offset = point_offset(angle - 135, 10);
	ctx.lineTo(ray.end.px + offset.px, ray.end.py + offset.py);
	var offset = point_offset(angle + 135, 10);
	ctx.lineTo(ray.end.px + offset.px, ray.end.py + offset.py);
	ctx.lineTo(ray.end.px, ray.end.py);
	
	ctx.stroke();
};
DebugSystem.prototype.draw_debug_square = function(ctx, square) {
	ctx.strokeStyle = square.color || '#f00';
	ctx.lineWidth = 2;
	
	ctx.beginPath();
	var width = square.width || 10;
	ctx.rect(square.pxy.px - width / 2, square.pxy.py - width / 2, width, width);
	
	ctx.stroke();
};
DebugSystem.prototype.add_debug_text = function(entry) {
	this.debug_text_entries.push({
		text: entry.text,
		update: entry.update,
		color: entry.color || '#f00',
		rays: entry.rays || [],
	});
};
DebugSystem.prototype.add_debug_ray = function(start, end, color, thickness) {
	this.next_debug_rays.push({
		start: start,
		end: end,
		color: color || '#f00',
		thickness: thickness || 1,
	});
};
DebugSystem.prototype.add_debug_square = function(pxy, width, color, thickness) {
	this.next_debug_squares.push({
		pxy: pxy,
		width: width,
		color: color,
		thickness: thickness,
	});
};








function GridSystem (game, sizex, sizey, width, height) {
	Entity.call(this, game);
	this.sizex = sizex;
	this.sizey = sizey;
	this.width = width;
	this.height = height;

	this.grid = this.generate_grid(0);
}
GridSystem.prototype = Object.create(Entity.prototype);
GridSystem.prototype.class_name = 'GridSystem';
GridSystem.prototype.generate_grid = function(value) {
	var grid = [];
	for (var x = 0; x < this.sizex; x++) {
		grid[x] = [];
		for (var y = 0; y < this.sizey; y++) {
			grid[x][y] = value;
		}
	}

	return grid;
};
GridSystem.prototype.get_point = function(px, py) {
	return [
		Math.floor(px / this.width),
		Math.floor(py / this.height),
	];
};

GridSystem.prototype.find_edges = function(initial_point, degree) {
	var points = [initial_point];
	var checked = this.generate_grid(false);
	checked[initial_point[0]][initial_point[1]] = true;
	var edges = [];

	degree = degree || 1;

	while (points.length > 0) {
		var new_points = [];

		for (var i = 0; i < points.length; i++) {
			var x = points[i][0];
			var y = points[i][1];

			if (this.grid[x][y]) {

				if (x > 0) {
					if (checked[x - 1][y] === false) {
						checked[x - 1][y] = true;
						new_points.push([x - 1, y]);
					}
				}
				if (y > 0) {
					if (checked[x][y - 1] === false) {
						checked[x][y - 1] = true;
						new_points.push([x, y - 1]);
					}
				}
				if (x < this.sizex - 1) {
					if (checked[x + 1][y] === false) {
						checked[x + 1][y] = true;
						new_points.push([x + 1, y]);
					}
				}
				if (y < this.sizey - 1) {
					if (checked[x][y + 1] === false) {
						checked[x][y + 1] = true;
						new_points.push([x, y + 1]);
					}
				}
			} else {
				edges.push([x, y]);
			}
		}
		points = new_points;
	}

	points = edges;
	for (var k = 1; k < degree; k++) {
		var new_edges = [];
		for (var i = 0; i < points.length; i++) {
			var x = points[i][0];
			var y = points[i][1];

			if (x > 0) {
				if (checked[x - 1][y] === false) {
					checked[x - 1][y] = true;
					if (!this.grid[x - 1][y])
						new_edges.push([x - 1, y]);
				}
			}
			if (y > 0) {
				if (checked[x][y - 1] === false) {
					checked[x][y - 1] = true;
					if (!this.grid[x][y - 1])
						new_edges.push([x, y - 1]);
				}
			}
			if (x < this.sizex - 1) {
				if (checked[x + 1][y] === false) {
					checked[x + 1][y] = true;
					if (!this.grid[x + 1][y])
						new_edges.push([x + 1, y]);
				}
			}
			if (y < this.sizey - 1) {
				if (checked[x][y + 1] === false) {
					checked[x][y + 1] = true;
					if (!this.grid[x][y + 1])
						new_edges.push([x, y + 1]);
				}
			}
		}
		points = new_edges;
		edges = edges.concat(new_edges);
	}

	return edges;
};

GridSystem.prototype.is_in_bounds = function(p, w, h) {
	// check that all points are in-bounds
	return p[0] >= 0 && p[0] + w - 1 < this.sizex && p[1] >= 0 && p[1] + h - 1 < this.sizey;
};

GridSystem.prototype.test_rect_equals = function(p, w, h, value) {
	// check that all points are in-bounds
	if (p[0] < 0 || p[0] + w - 1 >= this.sizex || p[1] < 0 || p[1] + h - 1 >= this.sizey)
		return undefined;

	// iterate map values
	for (var x = p[0]; x < p[0] + w; x++) {
		for (var y = p[1]; y < p[1] + h; y++) {
			if (this.grid[x][y] !== value) {
				return false;
			}
		}
	}

	// return true if we didn't find a counter point
	return true;
};

GridSystem.prototype.test_rect_contains = function(p, w, h, value) {
	// check that all points are in-bounds
	if (p[0] < 0 || p[0] + w - 1 >= this.sizex || p[1] < 0 || p[1] + h - 1 >= this.sizey)
		return undefined;

	// iterate map values
	for (var x = p[0]; x < p[0] + w; x++) {
		for (var y = p[1]; y < p[1] + h; y++) {
			if (this.grid[x][y] === value) {
				return true;
			}
		}
	}

	// return false if we didn't find a case
	return false;
};

GridSystem.prototype.rect_set = function(p, w, h, value) {
	// check that all points are in-bounds
	if (p[0] < 0 || p[0] + w - 1 >= this.sizex || p[1] < 0 || p[1] + h - 1 >= this.sizey)
		return;

	// iterate map values
	for (var x = p[0]; x < p[0] + w; x++) {
		for (var y = p[1]; y < p[1] + h; y++) {
			this.grid[x][y] = value;
		}
	}
};












function RenderedGridSystem (game, sizex, sizey, width, height) {
	GridSystem.call(this, game, sizex, sizey, width, height);
	this.rendered_grid = this.render();
}
RenderedGridSystem.prototype = Object.create(GridSystem.prototype);
RenderedGridSystem.prototype.class_name = 'RenderedGridSystem';
RenderedGridSystem.prototype.draw = function(ctx) {
	ctx.drawImage(this.rendered_grid, 0, 0, this.rendered_grid.width, this.rendered_grid.height);
};

RenderedGridSystem.prototype.render = function() {
	var buffer_canvas = document.createElement('canvas');
	buffer_canvas.width = this.width * this.sizex;
	buffer_canvas.height = this.height * this.sizey;

	var buffer_context = buffer_canvas.getContext('2d');
	buffer_context.imageSmoothingEnabled = false;

	this.render_rect(buffer_context, [0, 0], this.sizex, this.sizey);

	return buffer_canvas;
};

RenderedGridSystem.prototype.rect_set = function(p, w, h, value) {
	GridSystem.prototype.rect_set.call(this, p, w, h, value);
	this.update_render(p, w, h);
};
RenderedGridSystem.prototype.update_render = function(p, w, h) {
	if (this.is_in_bounds(p, w, h)) {
		var buffer_context = this.rendered_grid.getContext('2d');
		buffer_context.imageSmoothingEnabled = false;
		this.render_rect(buffer_context, p, w, h);
	}
};

