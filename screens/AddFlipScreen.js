import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as syncClient from '../utils/syncClient';
import { computeProfit, computeRoi } from '../utils/flipModel';
import FrostHeader from '../components/FrostHeader';
import SurfaceCard from '../components/SurfaceCard';
import { useTheme } from '../utils/theme';

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default' }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        keyboardType={keyboardType}
        style={{
          borderRadius: 18,
          backgroundColor: theme.inputBg,
          borderWidth: 1,
          borderColor: theme.inputBorder,
          color: theme.text,
          paddingHorizontal: 14,
          paddingVertical: 15,
          fontSize: 15
        }}
      />
    </View>
  );
}

function ActionButton({ label, onPress, primary = false, disabled = false }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: primary ? theme.accent : theme.secondaryButtonBg,
        borderRadius: 18,
        paddingVertical: 15,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: primary ? theme.accentBorder : theme.cardBorder,
        opacity: disabled || pressed ? 0.74 : 1
      })}
    >
      <Text style={{ color: primary ? theme.primaryButtonText : theme.secondaryButtonText, fontWeight: '900' }}>{label}</Text>
    </Pressable>
  );
}

export default function AddFlipScreen({ onClose = () => {}, onSaved = () => {} }) {
  const { theme } = useTheme();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [buy, setBuy] = useState('');
  const [sell, setSell] = useState('');
  const [fees, setFees] = useState('');
  const [shipping, setShipping] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const preview = useMemo(() => {
    const buyNum = Number(buy || 0);
    const sellNum = Number(sell || 0);
    const feesNum = Number(fees || 0);
    const shippingNum = Number(shipping || 8);
    const profit = computeProfit({ buy: buyNum, sell: sellNum, fees: feesNum, shipping: shippingNum });
    const roi = computeRoi({ buy: buyNum, profit });
    return { profit, roi };
  }, [buy, sell, fees, shipping]);

  const save = async () => {
    if (!title.trim() || !buy || !sell) {
      setError('Title, buy price, and sell price are required.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const res = await syncClient.createFlip({
        title: title.trim(),
        category: category.trim() || 'Manual',
        condition: condition.trim() || 'Unknown',
        buy: Number(buy),
        sell: Number(sell),
        fees: Number(fees || 0),
        shipping: Number(shipping || 8),
        confidence: 'MEDIUM',
        image: 'https://via.placeholder.com/800x600.png?text=Manual+Flip'
      });
      if (res?.ok && res.flip) {
        onSaved(res.flip);
        onClose();
      } else {
        setError('Could not save flip.');
      }
    } catch (e) {
      setError('Could not save flip.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FrostHeader title="Add Flip" subtitle="Capture a flip you found outside the feed." compact />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 132 }}>
          <SurfaceCard style={{ padding: 18, marginBottom: 14 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900', marginBottom: 4 }}>Item details</Text>
            <Text style={{ color: theme.subtext, lineHeight: 20, marginBottom: 18 }}>
              Add the basics first, then plug in your expected sale numbers to preview the margin.
            </Text>
            <Field label="TITLE" value={title} onChangeText={setTitle} placeholder="Vintage Nike jacket" />
            <Field label="CATEGORY" value={category} onChangeText={setCategory} placeholder="Streetwear" />
            <Field label="CONDITION" value={condition} onChangeText={setCondition} placeholder="Used - Good" />
          </SurfaceCard>

          <SurfaceCard style={{ padding: 18, marginBottom: 14 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900', marginBottom: 16 }}>Pricing</Text>
            <Field label="BUY PRICE" value={buy} onChangeText={setBuy} placeholder="65" keyboardType="decimal-pad" />
            <Field label="EXPECTED SELL PRICE" value={sell} onChangeText={setSell} placeholder="120" keyboardType="decimal-pad" />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label="FEES" value={fees} onChangeText={setFees} placeholder="15.60" keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="SHIPPING" value={shipping} onChangeText={setShipping} placeholder="8" keyboardType="decimal-pad" />
              </View>
            </View>
          </SurfaceCard>

          <SurfaceCard style={{ padding: 20 }} elevated>
            <Text style={{ color: theme.muted, fontSize: 11, letterSpacing: 1.3, fontWeight: '800' }}>ESTIMATED OUTCOME</Text>
            <Text style={{ color: preview.profit >= 0 ? theme.profit : theme.loss, fontSize: 44, fontWeight: '900', marginTop: 8 }}>
              {preview.profit >= 0 ? '+' : '-'}${Math.abs(preview.profit).toFixed(2)}
            </Text>
            <Text style={{ color: theme.accent, fontSize: 18, fontWeight: '800', marginTop: 4 }}>
              {preview.roi >= 0 ? '+' : '-'}{Math.abs(preview.roi).toFixed(1)}% ROI
            </Text>
            <Text style={{ color: theme.subtext, lineHeight: 20, marginTop: 8 }}>
              Profit is based on your expected sell price after fees and shipping.
            </Text>
          </SurfaceCard>

          {error ? (
            <SurfaceCard style={{ marginTop: 14, padding: 14, backgroundColor: theme.lossSoft }}>
              <Text style={{ color: theme.loss, fontWeight: '800' }}>{error}</Text>
            </SurfaceCard>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <ActionButton label="Cancel" onPress={onClose} disabled={busy} />
            <ActionButton label={busy ? 'Saving...' : 'Save Flip'} onPress={save} primary disabled={busy} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
