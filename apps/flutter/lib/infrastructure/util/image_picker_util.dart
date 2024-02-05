import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

Future<File?> showImagePicker(context) {
  return showModalBottomSheet<File>(
      context: context,
      builder: (BuildContext bc) {
        return SafeArea(
          child: Wrap(
            children: <Widget>[
              ListTile(
                  leading: const Icon(Icons.photo_library),
                  title: const Text('Galerie'),
                  onTap: () async {
                    final file = await pickImage(ImageSource.gallery);
                    Navigator.of(context).pop(file);
                  }),
              ListTile(
                leading: const Icon(Icons.photo_camera),
                title: const Text('Kamera'),
                onTap: () async {
                  final file = await pickImage(ImageSource.camera);
                  Navigator.of(context).pop(file);
                },
              ),
            ],
          ),
        );
      });
}

Future<File?> pickImage(ImageSource source) async {
  final picker = ImagePicker();
  final pickedFile = await picker.pickImage(source: source);

  if (pickedFile != null) {
    return File(pickedFile.path);
  }
  return null;
}
