/**
 * @namespace
 * @description Game management
 */
Wolf.PlayerAI = (function() {

	var pathToExit = [];
	
	function controlPlayer(game, level, player, tics)
	{
		/*code start here*/
		
		var dir = Wolf.Math.get4dir(Wolf.FINE2RAD(player.angle));
		var x = player.tile.x + Wolf.Math.dx4dir[dir];
		var y = player.tile.y + Wolf.Math.dy4dir[dir];
		
		//open doors automatically
		if (level.tileMap[x][y] & Wolf.DOOR_TILE) {
			var door = level.state.doorMap[x][y];
			if(door.action == Wolf.dr_closed || door.action == Wolf.dr_closing)
			{
				player.cmd.buttons |= Wolf.BUTTON_USE;
				console.log('use door');
			}
		}
		
		//use elevator (exit)
		if (level.tileMap[x][y] & Wolf.ELEVATOR_TILE) {
			player.cmd.buttons |= Wolf.BUTTON_USE;
			console.log('use elevator');
			pathToExit = [];
		}
		
		//secret wall
		if ((level.tileMap[x][y] & Wolf.SECRET_TILE)) {
			player.cmd.buttons |= Wolf.BUTTON_USE;
			console.log('use secret wall');
			pathToExit = [];
		}
		
		if((new Date).getTime() - game.level.state.startTime < 100) //player has died, reset path
		{
			pathToExit = [];
		}
		
		var checkTile = null;
		//if using knife, there must be no object (eg: pillar) between player and enemy
		if(player.ammo[Wolf.AMMO_BULLETS] == 0)
		{
			checkTile = function(x, y) {
				if (level.tileMap[x][y] & Wolf.BLOCK_TILE) {
					return false; // object is in path
				}
				return true;
			};
		}
		
		mindist = 0x7fffffff;
		closest = null;
		
		for (n=0;n < level.state.numGuards; ++n) {
			guard = level.state.guards[n];
			if (guard.flags & Wolf.FL_SHOOTABLE ) { // && Guards[n].flags&FL_VISABLE
			
				if (!Wolf.Level.checkLine(guard.x, guard.y, player.position.x, player.position.y, level, checkTile)) 
				{
					continue; // obscured
				}
				
				var d1 = Wolf.Math.lineLen2Point(guard.x - player.position.x, guard.y - player.position.y, player.angle);
				
				shotDist = Wolf.Math.point2LineDist(guard.x - player.position.x, guard.y - player.position.y, player.angle);
				if(d1 < 0) shotDist = 0x7fffffff;
				
				if (shotDist > mindist)
				{
					continue;
				}
				
				dx = Math.abs(guard.tile.x - player.tile.x);
				dy = Math.abs(guard.tile.y - player.tile.y);
				dist = Math.max(dx, dy);
				//if(dist > 2)
				if(dist >= 8 /*|| dist > mindist*/)
				{
					continue; //too far
				}
				
				mindist = shotDist;
				closest = guard;
			}
		}
		
		var isBoss = function(actor) { return actor.type == Wolf.en_boss || actor.type == Wolf.en_mecha || actor.type == Wolf.en_schabbs || actor.type == Wolf.en_hitler
		|| actor.type == Wolf.en_gretel || actor.type == Wolf.en_fat || actor.type == Wolf.en_gift; }
		
		//if a wall is getting pushed, reset path
		if(Wolf.PushWall.get().active)
		{
			pathToExit = [];
		}
		
		if(closest)
		{
			var d1 = Wolf.Math.lineLen2Point(closest.x - player.position.x, closest.y - player.position.y, player.angle);
			
			
			var dist = point2LineDistNotAbsolute(closest.x - player.position.x, closest.y - player.position.y, player.angle);
			if(d1 < 0) dist = 0x7fffffff * Math.sign(dist); 
			
			
			if(Math.abs(dist) > (2 * Wolf.TILEGLOBAL / 3))
			{
				turnangle = dist;
				
				player.angle -= Math.min(Math.max(turnangle, -Wolf.TURNANGLESCALE * tics), Wolf.TURNANGLESCALE * tics);
				
			}
			
			else
			{
				if (player.ammo[Wolf.AMMO_BULLETS] == 0 && dist < Wolf.TILE2POS(1)) {	
					player.moveAngle = player.angle;
					player.cmd.forwardMove += Wolf.RUNMOVE * Wolf.MOVESCALE;
					player.cmd.buttons |= Wolf.BUTTON_ATTACK;
				}
				else
				{
					player.cmd.buttons |= Wolf.BUTTON_ATTACK;
				}
				pathToExit = [];
			}
		}
		else if(!Wolf.PushWall.get().active && !(level.tileMap[x][y] & Wolf.ELEVATOR_TILE))
		{	
			//look for ammo / weapons
			if(pathToExit.length == 0)
			{
				pathToExit = findPath(player.tile.x, player.tile.y, level, player, function(x, y, cost) 
				{ 
					for (i=0; i < level.state.numPowerups; i++) {
						pow = level.state.powerups[i];
						if (pow.x == x && pow.y == y)
						{
							switch (pow.type) {
								case Wolf.pow_clip:
								case Wolf.pow_clip2:
								case Wolf.pow_25clip:
									if ((player.ammo[Wolf.AMMO_BULLETS] < 99 && cost < 15) || player.ammo[Wolf.AMMO_BULLETS] < 30) {
										console.log('found ammo');
										return true;
									}
									break;
									
								case Wolf.pow_machinegun:
									if (!(player.items & Wolf.ITEM_WEAPON_3)) {
										console.log('found machine gun');
										return true;
									}
									break;
									
								case Wolf.pow_chaingun:
									if (!(player.items & Wolf.ITEM_WEAPON_4)) {
										console.log('found chain gun');
										return true;
									}
									break;
									
								case Wolf.pow_alpo:
								case Wolf.pow_food:
								case Wolf.pow_firstaid:
									if ((player.health < 100 && cost < 20) || (player.health < 50 && cost < 100) || player.health < 30) {
										console.log('found food');
										return true;
									}
									break;
								
								case Wolf.pow_gibs:
									if ((player.health < 11 && cost < 25)) {
										console.log('found gibs');
										return true;
									}
									break;
							}
						}
					}
				});
			}

			//look for exit
			if(pathToExit.length == 0)
			{
				pathToExit = findPath(player.tile.x, player.tile.y, level, player, function(x, y, cost) 
				{ 
					if(((level.tileMap[x][y] & Wolf.ELEVATOR_TILE
					||  (level.tileMap[x][y] & Wolf.EXIT_TILE))
					|| (level.tileMap[x+1][y] & Wolf.ELEVATOR_TILE)
					|| (level.tileMap[x-1][y] & Wolf.ELEVATOR_TILE))
					&& !(level.tileMap[x][y] & Wolf.SECRETLEVEL_TILE))
					{
						console.log('found exit');
						return true;
					}
				});
			}
			
			//look for key 2
			if(pathToExit.length == 0)
			{	
				pathToExit = findPath(player.tile.x, player.tile.y, level, player, function(x, y, cost) 
				{ 
					for (i=0; i<level.state.numPowerups; i++) {
						pow = level.state.powerups[i];
						if (pow.x == x && pow.y == y && pow.type == Wolf.pow_key2) {
							console.log('found key 2');
							return true;
						}
					}
				});
			}
			
			//look for key 1
			if(pathToExit.length == 0)
			{
				pathToExit = findPath(player.tile.x, player.tile.y, level, player, function(x, y, cost) 
				{ 
					for (i=0; i<level.state.numPowerups; i++) {
						pow = level.state.powerups[i];
						if (pow.x == x && pow.y == y && pow.type == Wolf.pow_key1) {
							console.log('found key 1');
							return true;
						}
					}
				});
			}
			
			//look for boss
			if(pathToExit.length == 0)
			{				
				for (n=0;n < level.state.numGuards; ++n)
				{
					guard = level.state.guards[n];
					if (guard.flags & Wolf.FL_SHOOTABLE && isBoss(guard)) { 
						console.log('go fight boss');
						pathToExit = findPath(player.tile.x, player.tile.y, level, player, function(x, y, cost) 
						{ 
							if(x == guard.tile.x && y == guard.tile.y)
							{
								return true;
							}
						});
					}
				}
			}
			
			//follow path
			if(pathToExit.length > 0)
			{
				tileX = pathToExit[0].x;
				tileY = pathToExit[0].y;
				
				if(!(player.tile.x == tileX && player.tile.y == tileY))
				{
					tilePosX = Wolf.TILE2POS(tileX);
					tilePosY = Wolf.TILE2POS(tileY);
					
					d1 = Wolf.Math.lineLen2Point(tilePosX - player.position.x, tilePosY - player.position.y, player.angle);
					dist = point2LineDistNotAbsolute(tilePosX - player.position.x, tilePosY - player.position.y, player.angle);
					
					player.moveAngle = Wolf.RAD2FINE(Wolf.Math.transformPoint(tilePosX, tilePosY, player.position.x, player.position.y)) >> 0;
					player.cmd.forwardMove += Wolf.RUNMOVE * Wolf.MOVESCALE;
					
					if(d1 < 0) dist = 0x7fffffff * Math.sign(dist); 
					
					if(dist < 0)
					{
						player.angle += Math.min(Wolf.TURNANGLESCALE, (-dist / 50) >> 0) * tics;
					}
					else
					{
						player.angle -= Math.min(Wolf.TURNANGLESCALE,  (dist / 50) >> 0) * tics;
					}
				
				}
				else
				{
					pathToExit.shift();
				}
			}
		}
		
		drawMinimap(level, player, closest);
	}
	
	function point2LineDistNotAbsolute(x, y, a) {
		return (x * Wolf.Math.SinTable[a] - y * Wolf.Math.CosTable[a]) >> 0;
	}

	// a* with heuristic h(x) = 0
	function findPath(startx, starty, level, player, checkGoal)
	{			
		var pathToExit = [];

		//init checked array
		var checked = [];
		for (x=0;x<64;x++) {
			checked[x] = [];
			
			for (y=0;y<64;y++) {
				checked[x][y] = 999999;
			}
		}
		var queue = [];
		queue.push({ x : startx, y : starty, prev : null, cost : 0});
		
		while(queue.length > 0)
		{		
			//find element with minimum cost from queue and remove it 
			var min = queue[0];
			var minIndex = 0;

			for (var i = 1; i < queue.length; i++) {
				if (queue[i].cost < min.cost) {
					minIndex = i;
					min = queue[i];
				}
			}
			queue.splice(minIndex, 1);
			
			var pos = min;
			var x = pos.x;
			var y = pos.y;
			
			if(checkGoal(x, y, pos.cost))
			{
				//build path
				var current = pos;
				while(current != null)
				{
					//console.log(current);
					pathToExit.push(current);
					current = current.prev;
				}
				pathToExit.reverse();
				pathToExit.shift();	 //remove first element
				break;
			}
			
			var directions = [{x:(x+1), y:y    }, {x:(x-1), y:y    }, {x:x,     y:(y+1)}, {x:x,     y:(y-1)},
							  {x:(x+1), y:(y+1)}, {x:(x-1), y:(y+1)}, {x:(x+1), y:(y-1)}, {x:(x-1), y:(y-1)}
							 ];
			
			for(i = 0 ; i < directions.length; i++)
			{
				var direction = directions[i]; 
				
				//remove diagonal moves that touch walls
				if(direction.x >= 0 && direction.x < level.width 
				&& direction.y >= 0 && direction.y < level.height)
				{
					if(i == 4 && ((level.tileMap[x+1][y] & Wolf.SOLID_TILE) || (level.tileMap[x][y+1] & Wolf.SOLID_TILE)))
					{
						continue;
					}
					if(i == 5 && ((level.tileMap[x-1][y] & Wolf.SOLID_TILE) || (level.tileMap[x][y+1] & Wolf.SOLID_TILE)))
					{
						continue;
					}
					if(i == 6 && ((level.tileMap[x+1][y] & Wolf.SOLID_TILE) || (level.tileMap[x][y-1] & Wolf.SOLID_TILE)))
					{
						continue;
					}
					if(i == 7 && ((level.tileMap[x-1][y] & Wolf.SOLID_TILE) || (level.tileMap[x][y-1] & Wolf.SOLID_TILE)))
					{
						continue;
					}
				}
				
				//check if movement continue in same direction or change
				var cost;
				if(pos.prev == null || ((pos.x - pos.prev.x) == (direction.x - pos.x) && (pos.y - pos.prev.y) == (direction.y - pos.y)))
				{
					cost = pos.cost + Math.sqrt(Math.abs(direction.x-pos.x)+Math.abs(direction.y-pos.y));
				}
				else
				{
					cost = pos.cost + 8;
				}
				
				//destination is only possible if not a solid tile (eg :wall) or a locked door 
				//it is possible to walk trough solid tile if it is a secret tile and player is facing it
				
				if(direction.x >= 0 && direction.x < level.width 
				&& direction.y >= 0 && direction.y < level.height
				&& checked[direction.x][direction.y] > cost
				&& (!(level.tileMap[direction.x][direction.y] & Wolf.SOLID_TILE) || ((level.tileMap[direction.x][direction.y] & Wolf.SECRET_TILE) 
				         && !(level.tileMap[direction.x+direction.x-pos.x][direction.y+direction.y-pos.y] & (Wolf.SOLID_TILE | Wolf.DOOR_TILE))
						 && (i == 0 || i == 1 || i == 2 || i == 3)))
				/*&& isPassable(direction.x, direction.y)*/
				&& checkDoor(direction.x, direction.y, level, player))
				{
					checked[direction.x][direction.y] = cost; //never visit it again
					queue.push({ x : direction.x, y : direction.y, prev : pos, cost : cost});
				}
			}
		}
		return pathToExit;
	}
	
	
	function checkDoor(x, y, level, player)
	{ 
		if(level.tileMap[x][y] & Wolf.DOOR_TILE)
		{		
			var door = level.state.doorMap[x][y];
			switch (door.type) {
				case Wolf.DOOR_VERT:
				case Wolf.DOOR_HORIZ:
				case Wolf.DOOR_E_VERT:
				case Wolf.DOOR_E_HORIZ:
					return true;

				case Wolf.DOOR_G_VERT:
				case Wolf.DOOR_G_HORIZ:
					return (player.items & Wolf.ITEM_KEY_1);                     

				case Wolf.DOOR_S_VERT:
				case Wolf.DOOR_S_HORIZ:
					return (player.items & Wolf.ITEM_KEY_2); 
			}
        }		
		return true;
	}
	
	drawMinimap = function()
	{
		var canvaselement = document.getElementById('minimap');
		var canvas = canvaselement.getContext("2d");
		
		drawRect = function(x, y, color) {
			canvas.fillStyle = color; 
			canvas.fillRect(x*6, (63-y)*6, 6, 6);
		};
		
		return function(level, player, closest) {
			
			canvas.clearRect(0, 0, 384, 384);
			
			//path 
			for(var i = 0 ; i < pathToExit.length ; i++)
			{
				var path = pathToExit[i];
				drawRect(path.x, path.y, "white");
			}
			
			//tiles
			for (var x=0;x<64;x++) {
				for (var y=0;y<64;y++) {
					if(x == player.tile.x && y == player.tile.y) {
						drawRect(x,y,"red");
					}
					else if(level.tileMap[x][y]&Wolf.ELEVATOR_TILE) {
						drawRect(x,y,"lime");
					}
					else if(level.tileMap[x][y]&Wolf.DOOR_TILE && level.state.doorMap[x][y].action != Wolf.dr_open) {
						if(!checkDoor(x, y, level, player))
							drawRect(x,y,"gold");
						else
							drawRect(x,y,"darkgray");
					}
					else if(level.tileMap[x][y]&Wolf.SECRET_TILE) {
						drawRect(x,y,"darkgray");
					}					
					else if(level.tileMap[x][y]&Wolf.WALL_TILE) {
						drawRect(x,y,"gray");
					}
					else if(level.tileMap[x][y]&Wolf.SOLID_TILE) {
						drawRect(x,y,"rgb(50, 50, 50)");
					}
					
				}
			}
			
			//power ups
			for (var i=0; i<level.state.numPowerups; i++) {
				pow = level.state.powerups[i];
				if(pow.type == Wolf.pow_key1 || pow.type == Wolf.pow_key2) {
					drawRect(pow.x, pow.y, "gold");
				}
				else if(pow.type == Wolf.pow_alpo || pow.type == Wolf.pow_food || pow.type == Wolf.pow_firstaid) {
					drawRect(pow.x, pow.y, "green");
				}
				else if(pow.type == Wolf.pow_machinegun || pow.type == Wolf.pow_chaingun) {
					drawRect(pow.x, pow.y, "lime");
				}
				else if(pow.type == Wolf.pow_clip || pow.type == Wolf.pow_clip2 || pow.type == Wolf.pow_25clip) {
					drawRect(pow.x, pow.y, "LightSeaGreen");
				}
				
			}
			//enemies
			for (var n=0;n < level.state.numGuards; ++n) {
				guard = level.state.guards[n];
				if (guard.flags & Wolf.FL_SHOOTABLE )
				{				
					if(guard == closest)
						drawRect(guard.tile.x, guard.tile.y, "red");
					else
						drawRect(guard.tile.x, guard.tile.y, "darkred");
				}
			}
		};
		
	}()
	
	return {
		controlPlayer: controlPlayer
	};
})();