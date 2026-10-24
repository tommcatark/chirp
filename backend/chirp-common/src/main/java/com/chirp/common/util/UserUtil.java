package com.chirp.common.util;

public final class UserUtil {

    public static String handleOf(String email) {
        int at = email.indexOf('@');
        return at > 0 ? email.substring(0, at) : email;
    }

    private UserUtil() {}
}