import 'dart:io';

import 'package:flutter/material.dart';
import 'package:photo_view/photo_view.dart';

class ImageDialog extends StatelessWidget {
  final File file;

  const ImageDialog({Key? key, required this.file}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Dialog(child: PhotoView(imageProvider: FileImage(file)));
  }
}
