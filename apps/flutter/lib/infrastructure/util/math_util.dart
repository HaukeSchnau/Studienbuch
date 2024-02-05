import 'dart:math';

/// Converts degrees to radians.
double degreesToRads(double deg) {
  return (deg * pi) / 180.0;
}

/// Returns a point that is `distance` away from `from` in the direction of `deg`.
Point fromDistanceDeg(Point from, double deg, double distance) {
  return Point(
    from.x + (distance * cos(degreesToRads(deg))),
    from.y + (distance * sin(degreesToRads(deg))),
  );
}
