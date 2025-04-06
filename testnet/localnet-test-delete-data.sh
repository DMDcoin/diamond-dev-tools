#!/bin/sh

# Check if TESTNAME is defined
if [ -z "$TESTNAME" ]; then
  echo "Error: TESTNAME environment variable is not defined."
  exit 1
fi


# Define the base directory
BASE_DIR=$(pwd)/nodes-local-test-$TESTNAME/

DIRS=$(find $BASE_DIR -maxdepth 1 -mindepth 1 -type d)

# echo $DIRS
# Loop through each directory directly under the base directory
for dir in $DIRS ; do

  # Check if the directory exists
  if [ -d "$dir" ]; then
    # Remove the "data/cache" directory if it exists
    if [ -d "$dir/data/cache" ]; then
      echo "Removing cache directory: $dir/data/cache"
      rm -r "$dir/data/cache"
    fi
    # Remove the "data/chains" directory if it exists
    if [ -d "$dir/data/chains" ]; then
        echo "Removing cache directory: $dir/data/cache"
      rm -r "$dir/data/chains"
    fi
  fi
done