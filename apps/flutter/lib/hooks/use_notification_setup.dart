import 'package:class_mate/hooks/use_async_effect.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/openapi.dart';
import 'package:class_mate_api/api.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

bool hasStartMessagingRequest = false;

void useNotificationSetup() {
  final courses = useCourses();

  useAsyncEffect(() async {
    if (courses == null || courses.isEmpty || hasStartMessagingRequest) {
      return;
    }

    hasStartMessagingRequest = true;

    FirebaseMessaging messaging = FirebaseMessaging.instance;

    NotificationSettings settings = await messaging.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );

    debugPrint('User granted permission: ${settings.authorizationStatus}');
    if (settings.authorizationStatus != AuthorizationStatus.authorized) {
      return;
    }

    final token = await messaging.getToken();
    if (token == null) {
      return;
    }

    await apiInstance
        .mutationSubscriptionsSubscribe(MutationSubscriptionsSubscribeRequest(
      messagingToken: token,
      courses: courses.map((course) => course.id).toList(),
    ));

    hasStartMessagingRequest = false;
  }, [courses]);
}
