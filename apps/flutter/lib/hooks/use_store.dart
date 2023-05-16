import 'package:class_mate/models/store.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:provider/provider.dart';

GlobalStore useStore() {
  final context = useContext();
  final store = Provider.of<GlobalStore>(context, listen: true);
  return store;
}
