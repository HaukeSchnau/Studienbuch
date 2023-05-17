# Class Mate Mobile App

## How to build
Create a file called `key.properties` in the `android` folder with the following content:
```
storePassword=<password>
keyPassword=<password>
keyAlias=upload
storeFile=<path to key.jks>
```
Then run `flutter build appbundle --obfuscate --split-debug-info ./debug-symbols` in the root folder of the project.
