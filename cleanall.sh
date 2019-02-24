#!/bin/bash

folders=$(awk -F'/|#' '{ print $2}' .gitignore | xargs | awk -F' Build' '{ print $2}')
rm -rf $folders
lerna exec "rm -rf $folders" --no-bail