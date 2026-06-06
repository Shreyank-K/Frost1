import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import SurfaceCard from './SurfaceCard';
import { computeProfit, computeRoi } from '../utils/flipModel';
import * as syncClient from '../utils/syncClient';
import { useTheme } from '../utils/theme';
import { REWARDED_THRIFT_SCANS_PER_AD } from '../utils/adConfig';
import {
  consumeThriftScan,
  getThriftScanAllowance,
  grantRewardedThriftScans,
} from '../utils/thriftScanAllowance';
import { showRewardedThriftAd } from '../utils/rewardedAds';

const BARCODE_TYPES = ['upc_a', 'upc_e', 'ean13', 'ean8', 'code128', 'code39', 'code93', 'itf14'];

function money(value) {
  const numeric = Number(value || 0);
  return `$${numeric.toFixed(2)}`;
}

function MiniStat({ label, value, color, highlighted = false }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: highlighted ? theme.warningSoft : theme.surfaceElevated,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: highlighted ? theme.warning : theme.cardBorder,
        paddingVertical: 10,
        paddingHorizontal: 10,
      }}
    >
      <Text style={{ color: theme.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }}>{label}</Text>
      <Text style={{ color: color || theme.text, fontSize: 15, fontWeight: '900', marginTop: 5 }}>{value}</Text>
    </View>
  );
}

export default function ThriftModeModal({
  visible,
  onClose,
  onSaveFlip,
  userId = null,
}) {
  const { theme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLocked, setScanLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const [allowance, setAllowance] = useState(null);
  const [limitVisible, setLimitVisible] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [result, setResult] = useState(null);
  const [buyPrice, setBuyPrice] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adError, setAdError] = useState('');

  const estimate = useMemo(() => {
    const sell = Number(result?.analysis?.estimatedSellPrice || 0);
    const fees = Number(result?.analysis?.fees || 0);
    const shipping = Number(result?.analysis?.shipping || 0);
    const buy = Number(buyPrice || 0);
    const profit = computeProfit({ buy, sell, fees, shipping });
    const roi = computeRoi({ buy, profit });
    const shippingRatio = sell > 0 ? shipping / sell : 0;
    const costLoadRatio = sell > 0 ? (fees + shipping) / sell : 0;
    const shippingWarning =
      sell > 0 &&
      shipping > 0 &&
      (shippingRatio >= 0.45 || shipping >= sell || costLoadRatio >= 0.65);
    return { buy, sell, fees, shipping, profit, roi, shippingRatio, costLoadRatio, shippingWarning };
  }, [buyPrice, result]);

  useEffect(() => {
    let active = true;

    if (!visible) return () => {};

    getThriftScanAllowance({ userId })
      .then((nextAllowance) => {
        if (active) setAllowance(nextAllowance);
      })
      .catch(() => {
        if (active) setAllowance(null);
      });

    return () => {
      active = false;
    };
  }, [userId, visible]);

  const resetScan = () => {
    setScanLocked(false);
    setBusy(false);
    setSaving(false);
    setAdBusy(false);
    setLimitVisible(false);
    setBarcode('');
    setResult(null);
    setBuyPrice('');
    setError('');
    setNotice('');
    setAdError('');
  };

  const close = () => {
    resetScan();
    onClose();
  };

  const lookup = async (code) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await syncClient.lookupBarcode({ barcode: code });
      if (!response?.ok) {
        setError(response?.error || 'Could not look up that barcode.');
        return;
      }

      if (!response.matched) {
        setError(response.error || 'No eBay match found for this barcode.');
        return;
      }

      setResult(response);
    } finally {
      setBusy(false);
    }
  };

  const handleBarcodeScanned = async ({ data }) => {
    const code = String(data || '').trim();
    if (!code || scanLocked || busy || limitVisible) return;
    setScanLocked(true);
    setBarcode(code);
    setError('');
    setNotice('');
    setAdError('');

    try {
      const gate = await consumeThriftScan({ userId });
      setAllowance(gate.allowance);

      if (!gate.ok) {
        setLimitVisible(true);
        return;
      }

      lookup(code);
    } catch (err) {
      setScanLocked(false);
      setError(err?.message || 'Could not check your scan allowance. Try again.');
    }
  };

  const watchRewardedAd = async () => {
    if (adBusy) return;
    setAdBusy(true);
    setAdError('');
    setNotice('');

    try {
      const adResult = await showRewardedThriftAd();
      if (!adResult?.ok) {
        setAdError(adResult?.error || 'Could not show a rewarded ad right now.');
        return;
      }

      const grant = await grantRewardedThriftScans({ userId });
      setAllowance(grant.allowance);

      if (!grant?.ok) {
        setAdError(grant?.error || 'Could not unlock more scans right now.');
        return;
      }

      setNotice(`Unlocked ${REWARDED_THRIFT_SCANS_PER_AD} more Thrift Mode scans for today.`);
      setLimitVisible(false);
      setScanLocked(false);
    } finally {
      setAdBusy(false);
    }
  };

  const saveFlip = async () => {
    if (!result?.item) return;
    if (!estimate.buy || estimate.buy <= 0) {
      setError('Enter the store price before saving this flip.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await onSaveFlip?.({
        title: result.item.title,
        category: result.item.category || 'Thrift',
        condition: result.item.condition || 'Unknown',
        buy: estimate.buy,
        sell: estimate.sell,
        fees: estimate.fees,
        shipping: estimate.shipping,
        profit: estimate.profit,
        roi: estimate.roi,
        confidence: result.analysis?.confidence || 'LOW',
        image: result.item.image || undefined,
        sourceUrl: result.item.sourceUrl || null,
        sourceQuery: result.item.sourceQuery || `barcode:${result.barcode || barcode}`,
      });

      if (!response?.ok) {
        setError(response?.error || 'Could not save this flip.');
        return;
      }

      setNotice('Saved to My Flips.');
    } finally {
      setSaving(false);
    }
  };

  const profitColor = estimate.profit >= 0 ? theme.profit : theme.loss;
  const remainingScans = allowance?.remainingScans;
  const outOfFreeScans = allowance && Number.isFinite(remainingScans) && remainingScans <= 0;
  const showScanLimit = !result && !busy && (limitVisible || outOfFreeScans);
  const canScan = permission?.granted && !result && !busy && !showScanLimit;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'center', padding: 18 }}
      >
        <SurfaceCard style={{ borderRadius: 28, overflow: 'hidden', maxHeight: '92%' }} elevated>
          <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: theme.divider, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900' }}>Thrift Mode</Text>
              <Text style={{ color: theme.subtext, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
                Scan a UPC/EAN barcode, then Frost checks eBay resale comps.
              </Text>
            </View>
            <Pressable onPress={close} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }} style={{ padding: 8 }}>
              <Ionicons name="close" size={22} color={theme.muted} />
            </Pressable>
          </View>

          {showScanLimit ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <View
                style={{
                  width: 66,
                  height: 66,
                  borderRadius: 24,
                  backgroundColor: theme.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: theme.accentBorder,
                }}
              >
                <Ionicons name="play-circle-outline" size={34} color={theme.accent} />
              </View>
              <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900', marginTop: 16, textAlign: 'center' }}>
                Free scans used
              </Text>
              <Text style={{ color: theme.subtext, textAlign: 'center', lineHeight: 21, marginTop: 8 }}>
                Watch one rewarded ad to unlock {REWARDED_THRIFT_SCANS_PER_AD} more Thrift Mode scans today. Unlimited ad-free scans are planned for a later Pro beta, but this launch keeps Thrift Mode open through daily scans and rewarded unlocks.
              </Text>

              <View
                style={{
                  width: '100%',
                  backgroundColor: theme.surfaceElevated,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: theme.cardBorder,
                  padding: 14,
                  marginTop: 18,
                }}
              >
                <Text style={{ color: theme.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }}>TODAY</Text>
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '900', marginTop: 6 }}>
                  {allowance?.rewardAdsRemaining || 0} rewarded unlock{allowance?.rewardAdsRemaining === 1 ? '' : 's'} left
                </Text>
                <Text style={{ color: theme.subtext, fontSize: 12.5, lineHeight: 19, marginTop: 4 }}>
                  Each unlock adds {REWARDED_THRIFT_SCANS_PER_AD} scans. For this beta, rewarded unlocks are the path to more scans after the daily free limit.
                </Text>
              </View>

              {adError ? (
                <Text style={{ color: theme.loss, textAlign: 'center', fontWeight: '800', marginTop: 12 }}>{adError}</Text>
              ) : null}
              {notice ? (
                <Text style={{ color: theme.profit, textAlign: 'center', fontWeight: '900', marginTop: 12 }}>{notice}</Text>
              ) : null}

              <Pressable
                onPress={watchRewardedAd}
                disabled={adBusy || !allowance?.rewardAdsRemaining}
                style={({ pressed }) => ({
                  width: '100%',
                  marginTop: 18,
                  backgroundColor: theme.accent,
                  borderRadius: 18,
                  paddingVertical: 15,
                  alignItems: 'center',
                  opacity: adBusy || !allowance?.rewardAdsRemaining ? 0.58 : pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ color: theme.primaryButtonText, fontWeight: '900' }}>
                  {adBusy ? 'Loading ad...' : `Watch ad for +${REWARDED_THRIFT_SCANS_PER_AD} scans`}
                </Text>
              </Pressable>

              <Pressable onPress={close} style={{ marginTop: 14, padding: 6 }}>
                <Text style={{ color: theme.muted, fontWeight: '800' }}>Maybe later</Text>
              </Pressable>
            </View>
          ) : !permission ? (
            <View style={{ padding: 26, alignItems: 'center' }}>
              <ActivityIndicator color={theme.accent} />
              <Text style={{ color: theme.subtext, marginTop: 12 }}>Loading camera permissions...</Text>
            </View>
          ) : !permission.granted ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Ionicons name="camera-outline" size={34} color={theme.accent} />
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900', marginTop: 12 }}>Camera access needed</Text>
              <Text style={{ color: theme.subtext, textAlign: 'center', lineHeight: 21, marginTop: 8 }}>
                Frost needs camera access to scan thrift-store and retail product barcodes.
              </Text>
              <Pressable
                onPress={requestPermission}
                style={({ pressed }) => ({
                  marginTop: 18,
                  backgroundColor: theme.accent,
                  borderRadius: 18,
                  paddingHorizontal: 18,
                  paddingVertical: 13,
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ color: theme.primaryButtonText, fontWeight: '900' }}>Grant camera access</Text>
              </Pressable>
            </View>
          ) : result ? (
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ width: 94, height: 94, borderRadius: 20, overflow: 'hidden', backgroundColor: theme.surfaceElevated, borderWidth: 1, borderColor: theme.cardBorder }}>
                  {result.item?.image ? (
                    <Image source={{ uri: result.item.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="image-outline" size={28} color={theme.muted} />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text numberOfLines={3} style={{ color: theme.text, fontSize: 18, fontWeight: '900', lineHeight: 23 }}>
                    {result.item?.title || 'Scanned item'}
                  </Text>
                  <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 6 }}>
                    {result.item?.condition || 'Unknown'} · {result.item?.category || 'Thrift'}
                  </Text>
                  <Text style={{ color: theme.muted, fontSize: 11, marginTop: 5 }}>
                    Barcode {result.barcode || barcode}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <MiniStat label="SELL EST." value={money(estimate.sell)} color={theme.accent} />
                <MiniStat
                  label="SHIP EST."
                  value={money(estimate.shipping)}
                  color={estimate.shippingWarning ? theme.warning : theme.text}
                  highlighted={estimate.shippingWarning}
                />
                <MiniStat label="CONF." value={result.analysis?.confidence || 'LOW'} color={theme.warning} />
              </View>

              {estimate.shippingWarning ? (
                <View
                  style={{
                    marginTop: 12,
                    backgroundColor: estimate.shipping >= estimate.sell ? theme.lossSoft : theme.warningSoft,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: estimate.shipping >= estimate.sell ? theme.loss : theme.warning,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                  }}
                >
                  <Ionicons
                    name="cube-outline"
                    size={20}
                    color={estimate.shipping >= estimate.sell ? theme.loss : theme.warning}
                    style={{ marginRight: 10, marginTop: 1 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: estimate.shipping >= estimate.sell ? theme.loss : theme.warning, fontSize: 14, fontWeight: '900' }}>
                      Shipping is the deal killer here
                    </Text>
                    <Text style={{ color: theme.subtext, fontSize: 12.5, lineHeight: 19, marginTop: 5 }}>
                      Estimated shipping is {money(estimate.shipping)}, which is {Math.round(estimate.shippingRatio * 100)}% of the {money(estimate.sell)} sell estimate. Profit may stay negative unless the buyer pays shipping, you bundle it, or you can ship cheaper.
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={{ marginTop: 16 }}>
                <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 }}>STORE PRICE</Text>
                <TextInput
                  value={buyPrice}
                  onChangeText={setBuyPrice}
                  keyboardType="decimal-pad"
                  placeholder="How much is it on the shelf?"
                  placeholderTextColor={theme.muted}
                  style={{
                    backgroundColor: theme.inputBg,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: theme.inputBorder,
                    color: theme.text,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    fontSize: 16,
                    fontWeight: '800',
                  }}
                />
              </View>

              <View
                style={{
                  marginTop: 16,
                  borderRadius: 20,
                  padding: 16,
                  backgroundColor: estimate.profit >= 0 ? theme.profitSoft : theme.lossSoft,
                  borderWidth: 1,
                  borderColor: theme.cardBorder,
                }}
              >
                <Text style={{ color: theme.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }}>ESTIMATED PROFIT</Text>
                <Text style={{ color: profitColor, fontSize: 34, fontWeight: '900', marginTop: 6 }}>
                  {estimate.profit >= 0 ? '+' : '-'}{money(Math.abs(estimate.profit))}
                </Text>
                <Text style={{ color: profitColor, fontSize: 15, fontWeight: '900', marginTop: 2 }}>
                  {estimate.roi >= 0 ? '+' : '-'}{Math.abs(estimate.roi).toFixed(1)}% ROI
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <MiniStat label="BUY" value={money(estimate.buy)} />
                  <MiniStat label="FEES" value={money(estimate.fees)} />
                  <MiniStat
                    label="SHIP"
                    value={money(estimate.shipping)}
                    color={estimate.shippingWarning ? theme.warning : theme.text}
                    highlighted={estimate.shippingWarning}
                  />
                </View>
              </View>

              {error ? (
                <Text style={{ color: theme.loss, fontWeight: '800', marginTop: 12 }}>{error}</Text>
              ) : null}
              {notice ? (
                <Text style={{ color: theme.profit, fontWeight: '900', marginTop: 12 }}>{notice}</Text>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                <Pressable
                  onPress={resetScan}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: theme.secondaryButtonBg,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: theme.cardBorder,
                    paddingVertical: 14,
                    alignItems: 'center',
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <Text style={{ color: theme.secondaryButtonText, fontWeight: '900' }}>Scan another</Text>
                </Pressable>
                <Pressable
                  onPress={saveFlip}
                  disabled={saving}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: theme.accent,
                    borderRadius: 18,
                    paddingVertical: 14,
                    alignItems: 'center',
                    opacity: saving || pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ color: theme.primaryButtonText, fontWeight: '900' }}>
                    {saving ? 'Saving...' : 'Save Flip'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : (
            <View style={{ padding: 18 }}>
              <View
                style={{
                  marginBottom: 12,
                  backgroundColor: theme.surfaceElevated,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: theme.cardBorder,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: theme.text, fontSize: 13, fontWeight: '900' }}>
                    {allowance
                      ? `${allowance.remainingScans} scan${allowance.remainingScans === 1 ? '' : 's'} left today`
                      : 'Checking scan allowance...'}
                  </Text>
                  {allowance ? (
                    <Text style={{ color: theme.subtext, fontSize: 11.5, marginTop: 3 }}>
                      Watch a rewarded ad after the free limit to unlock more.
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="ticket-outline" size={20} color={theme.accent} />
              </View>
              {notice ? (
                <Text style={{ color: theme.profit, fontWeight: '900', textAlign: 'center', marginBottom: 12 }}>{notice}</Text>
              ) : null}

              <View style={{ height: 360, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000' }}>
                <CameraView
                  active={visible && canScan}
                  facing="back"
                  onBarcodeScanned={scanLocked ? undefined : handleBarcodeScanned}
                  barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
                  style={{ flex: 1 }}
                />
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 32,
                    right: 32,
                    top: 112,
                    height: 128,
                    borderRadius: 24,
                    borderWidth: 2,
                    borderColor: theme.accent,
                    backgroundColor: 'rgba(0,0,0,0.08)',
                  }}
                />
                <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.48)' }}>
                  <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center' }}>
                    Center the product barcode in the frame
                  </Text>
                </View>
              </View>

              {busy ? (
                <View style={{ alignItems: 'center', marginTop: 16 }}>
                  <ActivityIndicator color={theme.accent} />
                  <Text style={{ color: theme.subtext, marginTop: 10, fontWeight: '800' }}>
                    Looking up {barcode || 'barcode'} on eBay...
                  </Text>
                </View>
              ) : null}

              {error ? (
                <View style={{ marginTop: 16, backgroundColor: theme.lossSoft, borderRadius: 18, padding: 14 }}>
                  <Text style={{ color: theme.loss, fontWeight: '900' }}>{error}</Text>
                  <Pressable
                    onPress={resetScan}
                    style={({ pressed }) => ({
                      marginTop: 12,
                      backgroundColor: theme.secondaryButtonBg,
                      borderRadius: 14,
                      paddingVertical: 11,
                      alignItems: 'center',
                      opacity: pressed ? 0.92 : 1,
                    })}
                  >
                    <Text style={{ color: theme.secondaryButtonText, fontWeight: '900' }}>Try another scan</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
        </SurfaceCard>
      </KeyboardAvoidingView>
    </Modal>
  );
}
