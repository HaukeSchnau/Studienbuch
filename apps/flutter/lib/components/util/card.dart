import 'package:flutter/material.dart';

class MyCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double? width;
  final double? height;
  final Color color;
  final bool shadow;
  final void Function()? onTap;
  final bool disabled;
  final Clip clipBehavior;

  const MyCard(
      {super.key,
      required this.child,
      this.padding,
      this.margin,
      this.width,
      this.height,
      this.color = Colors.white,
      this.shadow = true,
      this.onTap,
      this.disabled = false,
      this.clipBehavior = Clip.none});

  @override
  Widget build(BuildContext context) {
    final padding = this.padding;
    var paddedChild = child;
    if (padding != null) paddedChild = Padding(padding: padding, child: child);
    return Opacity(
      opacity: disabled ? .5 : 1,
      child: Container(
        margin: margin,
        width: width,
        height: height,
        clipBehavior: clipBehavior,
        decoration: BoxDecoration(
            color: color,
            boxShadow: shadow
                ? [
                    const BoxShadow(
                        color: Color.fromRGBO(0, 0, 0, .16),
                        spreadRadius: 0,
                        offset: Offset(8, 8),
                        blurRadius: 24)
                  ]
                : [],
            borderRadius: const BorderRadius.all(Radius.circular(36))),
        child: onTap == null
            ? paddedChild
            : Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(40),
                  splashColor: Colors.black,
                  onTap: onTap,
                  child: paddedChild,
                ),
              ),
      ),
    );
  }
}
