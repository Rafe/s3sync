# s3sync

 Sync S3 buckets from git commit diffs (rsync style).

## Usage

install:

    npm install git://github.com/Rafe/s3sync.git

usage:

    var s3sync = require('s3sync');

    s3sync({
      'key': 'your s3 key',
      'secret': 'your s3 secret',
      'bucket': 'your s3 bucket',
      'gitRoot': 'your git path',
      'dir': 'target dir to be synced',
      'ignore': [ '^_', '.js', '.json$', 'node_modules', 'components' ],
      'complete': function() {
        console.log('sync complete')
      }
    });

## Authors

  - Francois Laberge ([@francoislaberge](http://twitter.com/francoislaberge))

## License

[The Mit License](http://opensource.org/licenses/MIT)
