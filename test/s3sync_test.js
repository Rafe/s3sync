var s3sync = require('../lib');

describe("s3sync", function() {
  it("can sync file to s3", function() {
    var sync = s3sync({})
    console.log(sync);
  });
});
