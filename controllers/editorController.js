function editorController($scope, ngProgressFactory, databaseService){
	$scope.id_editor = Math.floor(Math.random() * 100) + 1  ;
	var json2xls = require('json2xls');

	var ngProgress = ngProgressFactory.createInstance();
	ngProgress.setColor('#2C418D');

	$scope.langTools = ace.require("ace/ext/language_tools");

	$scope.init = function(){
    	databaseService.getConnecteds(function(res){
    		$scope.databases = res;
    	});
    	sizes();
    }

    $scope.aceOption = {
    	mode: 'sql',
    	require: ['ace/ext/language_tools'],
    	advanced: {
    		enableSnippets: true,
    		enableBasicAutocompletion: true,
    		enableLiveAutocompletion: true
    	},
    	onLoad: function(editor, session, ace){
    		$scope.langTools = ace.require('ace/ext/language_tools');
    		$scope.editor = editor;
    		$scope.session = session;
    		session.on('change',function(){
    			$scope.editorContent = session.getValue();
    		});
    	}
    };

    const app  = require('electron');

    var remote = app.remote; 
    var dialog = remote.dialog; 
    var globalShortcut = remote.globalShortcut;
    var win = app.remote.getCurrentWindow();


    function sizes(){
    	var total = $('.all').height();
    	if(total == 0){
    		total = (win.getSize()[1])-200;
    	}
    	var mid = total/2;
    	$('.mid').height(mid);
    }

    win.on("resize", function(r){
    	sizes();
    });

    var fs = require("fs");

    

    $scope.results = [];
    $scope.tables = [];
    $scope.fields = [];
    $scope.sql = '';
    $scope.winFocus = true;

    $scope.run = function(){
    	ngProgress.start();
    	if($scope.connection.path){
    		$scope.results = [];
    		selectionRange = $scope.editor.getSelectionRange();
    		var sql = $scope.session.getTextRange(selectionRange) || $scope.editorContent;
    		if(sql){


    			sql = sql.replace(/(\r\n|\n|\r)/gm,""); //remove \n
	    		var sqls = sql.split(/;(?=(?:(?:[^"]*"){2})*[^"]*$)(?=(?:(?:[^']*'){2})*[^']*$)/gi); // split by ;
	    		for(var i in sqls){ 
	    			if(sqls[i] && sqls[i] != ''){
	    				executing(sqls[i],i);	
	    			}
	    		}
    		}
    	}else{
    		dialog.showErrorBox("Error", "Please connect in a database");
    	}
    	ngProgress.complete();
    }


	$scope.$on('newConnection', function(event, args) {
		databaseService.getConnecteds(function(res){
    		$scope.databases = res;
    	});
	})

	function executeMore100(sqls){
		sqls = chunk(sqls,100);
		for(i in sqls){
			var sqlite = require("sqlite-cipher");
			var list = sqls[i];
			for(j in list){
				if(list[j] && list[j] != ''){
    				executing(list[j],j);	
    			}
			}
		}
	}

	function executing(sql, line){
		$scope.show_counter = false;
		line++;
		var sqlite = require("sqlite-cipher");
		sqlite.connect($scope.connection.path, $scope.connection.password, $scope.connection.algorithm);
		sql = sql.trim();
		var type = sql.substring(0,6);
		type = type.toUpperCase();

		var funcs = databaseService.getFunctionsAsync($scope.connection.id);

		for(i in funcs){
			eval(funcs[i].function)
			sqlite.create_function(eval(funcs[i].name))
		}

		sqlite.run(sql, function(res){
			if(res.error){
				$scope.results.push({type:"alert",class:"alert-danger",message:res.error.message+" - Line: "+line+" - "+sql});
			}else{
				switch(type){
					case "INSERT":
						$scope.results.push({type:"alert",class:"alert-success",message:"Line: "+line+" - Success - insert id: "+res});
						break;
					case "UPDATE":
						$scope.results.push({type:"alert",class:"alert-success",message:"Line: "+line+" - Success - Affected rows: "+res});
						break;
					case "DELETE":
						$scope.results.push({type:"alert",class:"alert-success",message:"Line: "+line+" - Success - Affected rows: "+res});
						break;
					case "SELECT":
						if(res.length){
							$scope.results.push({type:"table",rows:res, fields:fields(res)});
							$scope.show_counter = true;
							$scope.counter = res.length;
						}else{
							$scope.results.push({type:"alert",class:"alert-warning",message:"Line: "+line+" - No results found!"});
						}
						break;
					case "CREATE":
						$scope.results.push({type:"alert",class:"alert-success",message:"Line: "+line+" - Success!"});
						break;
					default:
						$scope.results.push({type:"alert",class:"alert-success",message:"Line: "+line+" - Success!"});
						break;
				}
			}
		});
		sqlite.close();
		$scope.$emit("change");
	}

	function fields(data){
		var row = data[0];
		return Object.keys(row);
	}

	$scope.save = function(){
		dialog.showSaveDialog(function (fileName) {
			var sql = $("<div>"+$scope.editorContent+"</div>").text();
			fs.writeFile(fileName, sql, function(err){
				dialog.showMessageBox({ message: "The file has been saved!",buttons: ["OK"],type :'info', title:"SQLite-cipher App" });
			});
		}); 
	}

	// Autocompleter
	var completerTables = {
		getCompletions: function(editor, session, pos, prefix, callback) {
			if (prefix.length === 0) { callback(null, $scope.tables.map(function(ea){
				callback(null, $scope.tables.map(function(ea)  {           
					return {name: ea.name, value: ea.name, meta: "TABLE"}
				}));
			})); }
			var sqlite = require("sqlite-cipher");
			sqlite.connect($scope.connection.path, $scope.connection.password, $scope.connection.algorithm);
			sqlite.run("SELECT * FROM sqlite_master WHERE type = 'table' AND name <> 'sqlite_sequence'", function(tables){
				$scope.tables = tables
				callback(null, tables.map(function(ea)  {           
					return {name: ea.name, value: ea.name, meta: "TABLE"}
				}));
			});
		}
	}

	var completerFields = {
		getCompletions: function(editor, session, pos, prefix, callback) {
			var tables = getStatementTables($scope.sql);
			if (prefix.length === 0) { callback(null, $scope.fields.map(function(ea){
				callback(null, $scope.fields.map(function(ea)  {           
					return {name: ea.name, value: ea.name, meta: "From: "+ea.table+" Type: "+ea.type}
				}));
			})); }

			if(tables.length){
				$scope.fields = [];
				var sqlite = require("sqlite-cipher");
				sqlite.connect($scope.connection.path, $scope.connection.password, $scope.connection.algorithm);
				for(i in tables){
					var fields = sqlite.run("PRAGMA table_info(?) ",[tables[i]]);
					for(j in fields){
						fields[j].table = tables[i];
						$scope.fields.push(fields[j]);
					}
				}
				callback(null, $scope.fields.map(function(ea){
					return {name: ea.name, value: ea.name, meta: "From: "+ea.table+" Type: "+ea.type}
				}))
			}
			
		}
	}

	$scope.test = function(){
		// console.log($scope.editorContent);
	}


	$scope.changeConnection = function(a){
		$scope.connection = a
		$scope.langTools.addCompleter(completerTables);
	}

	$scope.$on('activeTab', function(ev, args){
		$scope.tab_active = args.tab_id == $scope.tab_id;
		if($scope.tab_active){
			globalShortcut.register('F5', () => {
				$scope.run();
				$scope.$apply();
			});

			globalShortcut.register('F9', () => {
				$scope.run();
				$scope.$apply();
			});

			globalShortcut.register('CommandOrControl+S', () => {
				$scope.save();
			});
		}else{
			
		}
	})

	globalShortcut.register('F5', () => {
		$scope.run();
		$scope.$apply();
	});

	globalShortcut.register('F9', () => {
		$scope.run();
		$scope.$apply();
	});


	globalShortcut.register('CommandOrControl+S', () => {
		$scope.save();
	});
	

	win.on("focus", function(){
    	globalShortcut.register('F5', () => {
			$scope.run();
			$scope.$apply();
		});

		globalShortcut.register('F9', () => {
		$scope.run();
		$scope.$apply();
	});

		globalShortcut.register('CommandOrControl+S', () => {
			$scope.save();
		});
    });

    win.on("blur", function(){
    	globalShortcut.unregisterAll();
    });

    $scope.exportExcel = function(){
    	var options = {
    		filters:[
    			{
    				name:"Excel file (.xlsx | .xls)", 
    				extensions: ['xlsx', 'xls']
    			}
    		]
    	};
    	dialog.showSaveDialog(options,function (fileName) {
    		var data =  angular.toJson($scope.results[0].rows);
    		var xls = json2xls(JSON.parse(data));
			fs.writeFile(fileName, xls, 'binary', function(err){
				if(err){
					alert(err)
				}else{
					dialog.showMessageBox({ message: "The file has been saved!",buttons: ["OK"],type :'info', title:"SQLite-cipher App" });
				}
			});
    	});
    }

	function getStatementTables(sql){
		var re = /\b(?:from|into|update|join)\s+(\w+)/gi; 
		var m;
		var tables = [];
		while ((m = re.exec(sql)) !== null) {
			if (m.index === re.lastIndex) {
				re.lastIndex++;
			}
			tables.push(m[1])
		}
		return tables;
	}

	function  chunk(arr,size) {
		var newArr = [];
		for(var i = 0 ; i < arr.length; i+=size){
			newArr.push(arr.slice(i, i+size));
		}
		return newArr;
	}

}

app.controller('editorController',editorController);