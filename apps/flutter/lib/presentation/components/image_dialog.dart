import 'dart:io';

import 'package:flutter/material.dart';
import 'package:photo_view/photo_view.dart';

class ImageDialog extends StatelessWidget {
  final File file;

  const ImageDialog({super.key, required this.file});

  @override
  Widget build(BuildContext context) {
    return Dialog(child: PhotoView(imageProvider: FileImage(file)));
  }
}
