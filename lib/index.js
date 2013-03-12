var knox = require('knox'),
    fs = require('fs'),
    exec = require('child_process').exec,
    util = require('util'),
    path = require('path'),
    _ = require('underscore'),
    debug = require('debug')('s3sync');

var s3sync = function(options){
  var self = this;

  var required = [
    'key',
    'secret',
    'bucket',
    'gitRoot'
  ];

  var defaults = {
    history:      'history.json',
    latest:       'HEAD',
    webRoot:      '',
    s3Root:       '',
    include:      [],
    dir:          "",
    complete:     function(){},
  };

  this.config = _.extend(defaults, options);

  if(!this.valid(required)){
    return;
  }

  this.client = knox.createClient({
    key:    this.config.key,
    secret: this.config.secret,
    bucket: this.config.bucket
  });

  //  - Load the sync history .json file if it's available.
  //  - If the file exist use the last sync commit hash.
  //  - If it doens't exist sync all files. Then create and store the history
  //    file for next time.
  //  - Also if no options.previous is provided then upload everything (All currently tracked files).

  // Get the list of files changed/updated/deleted based on config from git
  this.getOperations(function(operations){

    //add explicit included files
    self.config.include.forEach(function(included) {
      operations.push({
        op: 'A',
        filename: included
      });
    });

    // Update the S3 bucket.
    self.syncFiles(operations);
  });
}

s3sync.prototype.syncFiles = function(operations){
  var self = this;

  if(!operations.length){
    if(self.config.complete){
      self.config.complete();
    }
    console.log('============Finished Successfully============');
    return;
  }

  var operation = operations.shift();

  self.sync(operation.op, operation.filename.slice(self.config.webRoot.length), function() {
    self.syncFiles(operations);
  });
}

s3sync.prototype.sync = function(op, filename, next) {
  var self = this;
  if( op == 'A' || op == 'U' ){
    self.client.putFile(
      path.join(self.config.dir, filename),
      path.join(self.config.s3Root, filename),
      function(err, res){
        if(err){
          console.log(err);
        } else {
          console.log(filename + (op == 'A' ? ' added at' : ' moved to')
                    , path.join(self.config.bucket, self.config.s3Root, filename));
        }
        next();
      }
    );
  } else if(op=='D'){
    this.client.del(path.join(self.config.s3Root, filename)).on('response', function(res){
      debug(res.statusCode);
      debug(res.headers);
      console.log(filename + ' deleted at ' + self.config.bucket
                , path.join(self.config.s3Root, filename))
      next();
    });
  }
}

s3sync.prototype.shouldIgnore = function(filename, op){
  var self = this;
  if(filename == ""){
    return true;
  }

  // Ignore files not in the webRoot folder. (This is
  // because git diff --name-only always returns all files
  // changed between the commits regardless of which subfolder
  // you are in.
  var found = filename.search(self.config.webRoot);
  if(found != 0 && self.config.webRoot != "" ){
    debug('f: ' + filename);
    debug('%s file ignored. Not in webRoot', filename);
    return true;
  }

  // Ignore directories.
  if(op != 'D'){
    var stats = fs.lstatSync( path.join(self.config.dir, filename));
    if(stats.isDirectory()){
      console.log('%s directory ignored.', filename);
      return true;
    }
  }

  // Ignore files
  for(var i = 0; i < self.config.ignore.length; i++) {
    var regex = new RegExp(self.config.ignore[i]);
    if( regex.test(filename) ) {
      return true;
    }
  }
  return false;
}

s3sync.prototype.getOperations = function(callback){
  var operations = []
    , self = this
    , gitCommand
    , parser;

  if(self.config.previous){
    gitCommand = 'git diff --name-status '
                   + self.config.previous + ' '
                   + self.config.latest;
    parse = function(line) {
      return {
        op: line.charAt(0),
        filename : line.slice(2).trim()
      }
    }
  } else {
    gitCommand = 'git ls-files';
    parse = function(line) {
      return {
        op: 'A',
        filename: line
      };
    };
  }

  process.chdir(self.config.dir);
  exec(gitCommand, function (error, stdout, stderr) {
    if (error) {
      console.log('Error running '+ gitCommand + ':\n' + error);
      console.log('aborting sync');
      process.exit(0);
    }

    // Convert git output into an array of file operations.
    stdout.split('\n').forEach(function(line, index) {
      // The first character of the line is the operation (A=Added,D=Deleted,U=Updated)
      var result = parse(line);

      if(!self.shouldIgnore(result.filename, result.op)){
        operations.push(result);
      }
    });

    callback(operations);
  });
}

s3sync.prototype.valid = function(required) {
  for(var i = 0; i < required.length; i++){
    if(!this.config[required[i]]){
      console.log(required[i] + ' is a required option.');
      return false;
    }
  }
  return true
}

module.exports = function(options) {
  return new s3sync(options);
}
