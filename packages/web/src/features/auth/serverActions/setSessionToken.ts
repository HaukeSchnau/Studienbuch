"use client";

export const setSessionToken = async (sessionToken: string) => {
  if (sessionToken) {
    window.location.href = "/admin";
  }
};
