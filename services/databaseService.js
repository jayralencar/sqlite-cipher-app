app.service('databaseService', function() {
	var databases = [];

	var actions = {};

	actions.addDatabase = function(data){
		basel.database.insert('databases', data);
	}

	actions.getDatabase = function(callback){
		basel.database.run("SELECT * FROM databases WHERE active = 1", function(res){
			callback(res);
		})
	}

	actions.getConnecteds = function(callback){
		callback(databases);
	}

	actions.connect = function(data){
		// var sqlite = require('sqlite-cipher');
		// sqlite.connect(data.path, data.password, data.algorithm);
		// data.connection = sqlite;
		
		databases.push(data);
	}

	return actions;
});