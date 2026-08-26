import { CORE_VERSION, cryptoIdGenerator, systemClock, todayFor } from '@app/core';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Foundation smoke screen — NOT a product screen (SPEC-000 NG1, §14).
 * Renders values computed by @app/core to prove Hermes runs the shared package
 * (Intl timezone conversion + Web Crypto). Replaced under SPEC-001.
 */
export function FoundationStatusScreen() {
  const now = systemClock.now();
  const today = todayFor(systemClock, 'America/Sao_Paulo');
  const id = cryptoIdGenerator.next();

  return (
    <View style={styles.container} accessibilityRole="summary">
      <Text style={styles.title} accessibilityRole="header">
        Foundation OK
      </Text>
      <Text style={styles.line} testID="core-version">
        core {CORE_VERSION}
      </Text>
      <Text style={styles.line} testID="now">
        now {now}
      </Text>
      <Text style={styles.line} testID="today">
        today (America/Sao_Paulo) {today}
      </Text>
      <Text style={styles.line} testID="uuid">
        uuid {id}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 24, fontWeight: '600' },
  line: { fontSize: 14, fontFamily: 'monospace' },
});
