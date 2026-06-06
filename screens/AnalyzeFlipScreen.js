import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as syncClient from '../utils/syncClient';
import FrostHeader from '../components/FrostHeader';
import SurfaceCard from '../components/SurfaceCard';
import { useTheme } from '../utils/theme';

function InputField({ label, value, onChangeText, placeholder, keyboardType = 'default' }) {
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
          fontSize: 15,
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
        opacity: disabled || pressed ? 0.74 : 1,
      })}
    >
      <Text style={{ color: primary ? theme.primaryButtonText : theme.secondaryButtonText, fontWeight: '900' }}>{label}</Text>
    </Pressable>
  );
}

function ComparableRow({ item }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={() => item.itemWebUrl && Linking.openURL(item.itemWebUrl).catch(() => {})}
      style={({ pressed }) => ({
        flexDirection: 'row',
        backgroundColor: theme.surfaceElevated,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.cardBorder,
        padding: 12,
        marginBottom: 10,
        opacity: pressed ? 0.94 : 1,
      })}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={{ width: 58, height: 58, borderRadius: 16, backgroundColor: theme.surfaceSoft }} />
      ) : (
        <View style={{ width: 58, height: 58, borderRadius: 16, backgroundColor: theme.surfaceSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="image-outline" size={22} color={theme.muted} />
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text numberOfLines={2} style={{ color: theme.text, fontSize: 14, fontWeight: '800', lineHeight: 18 }}>{item.title}</Text>
        <Text style={{ color: theme.subtext, marginTop: 6 }}>{item.condition || 'Unknown condition'}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Text style={{ color: theme.profit, fontSize: 16, fontWeight: '900' }}>${Number(item.price || 0).toFixed(2)}</Text>
        <Ionicons name="open-outline" size={15} color={theme.muted} />
      </View>
    </Pressable>
  );
}

function FeatureBullet({ label }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 }}>
      <Ionicons name="lock-closed" size={14} color={theme.accent} style={{ marginTop: 2 }} />
      <Text style={{ color: theme.subtext, flex: 1, lineHeight: 19, marginLeft: 8 }}>{label}</Text>
    </View>
  );
}

export default function AnalyzeFlipScreen({
  onClose = () => {},
  onSaved = () => {},
  onAnalyzeComplete = () => {},
}) {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');

  const analyze = async () => {
    if (!query.trim() || !buyPrice) {
      setError('Item title and buy price are required.');
      return;
    }
    setError('');
    setLoading(true);
    setAnalysis(null);
    const res = await syncClient.analyzeFlip({ query: query.trim(), buyPrice: Number(buyPrice) });
    setLoading(false);
    if (res?.ok && res.analysis) {
      setAnalysis(res.analysis);
      onAnalyzeComplete?.();
    } else {
      setError(res?.error || 'Could not analyze this flip.');
    }
  };

  const saveAnalyzed = async () => {
    if (!analysis) return;
    try {
      const category = query.toLowerCase().includes('nike') || query.toLowerCase().includes('jordan') ? 'Sneakers'
        : query.toLowerCase().includes('iphone') || query.toLowerCase().includes('airpods') || query.toLowerCase().includes('macbook') ? 'Electronics'
        : query.toLowerCase().includes('pokemon') || query.toLowerCase().includes('lego') ? 'Collectibles'
        : 'Manual';
      const res = await syncClient.createFlip({
        title: query.trim(),
        category,
        condition: 'Unknown',
        buy: Number(buyPrice),
        sell: analysis.estimatedSellPrice,
        fees: analysis.fees,
        shipping: analysis.shipping,
        profit: analysis.profit,
        roi: analysis.roi,
        confidence: analysis.confidence,
        image: analysis.comparables?.[0]?.imageUrl || 'https://via.placeholder.com/800x600.png?text=Analyzed+Flip',
      });
      if (res?.ok && res.flip) {
        onSaved(res.flip);
        onClose();
      } else {
        setError('Could not save analyzed flip.');
      }
    } catch (e) {
      setError('Could not save analyzed flip.');
    }
  };

  const confidenceScore = Number(analysis?.confidenceScore || 0);
  const confColor = analysis?.confidence === 'HIGH' ? theme.profit : analysis?.confidence === 'MEDIUM' ? theme.warning : theme.loss;
  const confidenceWidth = `${Math.max(8, Math.min(100, Math.round(confidenceScore * 100)))}%`;
  const visibleComparables = analysis?.comparables || [];
  const hiddenComparableCount = Math.max(0, Number(analysis?.comparableCount || 0) - visibleComparables.length);
  const lockedFeatures = Array.isArray(analysis?.lockedFeatures) ? analysis.lockedFeatures : [];

  const verdict = useMemo(() => {
    if (!analysis) return null;
    if (analysis.profit < 0 || analysis.roi < 0) {
      return 'Pass at this buy price — even if the comps are usable, the margin does not survive fees and shipping.';
    }
    if (analysis.profit >= 35 && analysis.roi >= 18 && confidenceScore >= 0.72) {
      return 'Strong candidate — the buy price leaves real room and the comp set supports the resale target.';
    }
    if (analysis.profit >= 15 && analysis.roi >= 8 && confidenceScore >= 0.42) {
      return 'Worth a closer look — the flip still has room, but execution and condition matter.';
    }
    if (confidenceScore >= 0.6) {
      return 'The comps look believable, but the current buy price leaves too little margin to feel safe.';
    }
    return 'Weak read — the comp set is shaky or the edge is too thin to trust.';
  }, [analysis, confidenceScore]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FrostHeader title="Analyze Flip" subtitle="Get a smarter read on comps, confidence, and why the margin works." compact />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 132 }}>
          <SurfaceCard style={{ padding: 18 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900', marginBottom: 4 }}>Analyzer</Text>
            <Text style={{ color: theme.subtext, lineHeight: 20, marginBottom: 18 }}>
              Enter a searchable title and your buy cost. Frost will check live comps, estimate resale, and call out the confidence behind the number.
            </Text>

            <InputField label="ITEM TITLE" value={query} onChangeText={setQuery} placeholder="Nike Air Force 1 White Size 10" />
            <InputField label="BUY PRICE" value={buyPrice} onChangeText={setBuyPrice} placeholder="65" keyboardType="decimal-pad" />

            <ActionButton label={loading ? 'Analyzing...' : 'Analyze Flip'} onPress={analyze} primary disabled={loading} />
          </SurfaceCard>

          {error ? (
            <SurfaceCard style={{ marginTop: 14, padding: 14, backgroundColor: theme.lossSoft }}>
              <Text style={{ color: theme.loss, fontWeight: '800' }}>{error}</Text>
            </SurfaceCard>
          ) : null}

          {!analysis && !error ? (
            <SurfaceCard style={{ padding: 20, marginTop: 14 }} elevated>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>Ready when you are</Text>
              <Text style={{ color: theme.subtext, lineHeight: 21, marginTop: 8 }}>
                Frost will show more than a single number now: expected profit, confidence score, comparable listings, and what made the estimate believable.
              </Text>
            </SurfaceCard>
          ) : null}

          {analysis ? (
            <>
              <SurfaceCard style={{ padding: 20, marginTop: 14 }}>
                <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 }}>ANALYSIS RESULT</Text>
                <Text style={{ color: Number(analysis.profit || 0) >= 0 ? theme.profit : theme.loss, fontSize: 44, fontWeight: '900', marginTop: 10 }}>
                  {Number(analysis.profit || 0) >= 0 ? '+' : '-'}${Math.abs(Number(analysis.profit || 0)).toFixed(2)}
                </Text>
                <Text style={{ color: theme.accent, fontSize: 18, fontWeight: '800', marginTop: 4 }}>
                  {Number(analysis.roi || 0).toFixed(1)}% ROI
                </Text>

                <View style={{ marginTop: 16, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: confColor, fontWeight: '900' }}>{analysis.confidence || 'LOW'} DEAL CONFIDENCE</Text>
                    <Text style={{ color: theme.text, fontWeight: '800' }}>{Math.round(confidenceScore * 100)}%</Text>
                  </View>
                  <View style={{ marginTop: 8, height: 10, borderRadius: 999, backgroundColor: theme.surfaceElevated, overflow: 'hidden' }}>
                    <View style={{ width: confidenceWidth, height: '100%', backgroundColor: confColor, borderRadius: 999 }} />
                  </View>
                  <Text style={{ color: theme.subtext, lineHeight: 18, marginTop: 10 }}>
                    Free mode shows the headline answer first. Deeper pricing guardrails and the full comp trail are planned for a later Pro beta.
                  </Text>
                </View>

                <SurfaceCard style={{ padding: 14, marginTop: 4, backgroundColor: theme.surfaceElevated }}>
                  <Text style={{ color: theme.text, fontSize: 15, fontWeight: '900' }}>Why this score?</Text>
                  <Text style={{ color: theme.subtext, lineHeight: 20, marginTop: 6 }}>{verdict}</Text>
                </SurfaceCard>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 14 }}>
                  {[
                    ['Sell Price', `$${Number(analysis.estimatedSellPrice || 0).toFixed(2)}`],
                    ['Fees', `$${Number(analysis.fees || 0).toFixed(2)}`],
                    ['Shipping', `$${Number(analysis.shipping || 0).toFixed(2)}`],
                    ['Comparables', `${visibleComparables.length}/${analysis.comparableCount || visibleComparables.length}`],
                  ].map(([label, value]) => (
                    <View
                      key={label}
                      style={{
                        width: '48%',
                        backgroundColor: theme.surfaceElevated,
                        borderRadius: 18,
                        padding: 14,
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: theme.cardBorder,
                      }}
                    >
                      <Text style={{ color: theme.muted, fontSize: 10, letterSpacing: 1.2, fontWeight: '800' }}>{label}</Text>
                      <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900', marginTop: 8 }}>{value}</Text>
                    </View>
                  ))}
                </View>
              </SurfaceCard>

              {analysis?.proLocked ? (
                <SurfaceCard style={{ padding: 18, marginTop: 14, backgroundColor: theme.accentSoft }}>
                  <Text style={{ color: theme.text, fontSize: 17, fontWeight: '900' }}>Advanced pricing opens later</Text>
                  <Text style={{ color: theme.subtext, lineHeight: 20, marginTop: 6 }}>
                    This launch keeps the core answer free. Advanced pricing will land later as a Pro beta focused on safer guardrails, deeper context, and the full comp trail.
                  </Text>
                  {lockedFeatures.map((feature) => <FeatureBullet key={feature} label={feature} />)}
                  <Text style={{ color: theme.text, fontSize: 12, fontWeight: '800', marginTop: 14 }}>
                    For now, free includes the headline result and a short comparable sample.
                  </Text>
                </SurfaceCard>
              ) : null}

              {!!visibleComparables?.length && (
                <SurfaceCard style={{ padding: 18, marginTop: 14 }}>
                  <Text style={{ color: theme.text, fontSize: 17, fontWeight: '900' }}>Comparable sample</Text>
                  <Text style={{ color: theme.subtext, lineHeight: 20, marginTop: 6 }}>
                    This beta includes a short comp sample. The full set is planned for the advanced pricing release.
                  </Text>
                  <View style={{ marginTop: 14 }}>
                    {visibleComparables.slice(0, 2).map((item) => <ComparableRow key={`${item.itemWebUrl || item.title}-${item.price}`} item={item} />)}
                  </View>
                  {hiddenComparableCount > 0 ? (
                    <Text style={{ color: theme.muted, marginTop: 6, fontSize: 12 }}>
                      +{hiddenComparableCount} more comparable{hiddenComparableCount === 1 ? '' : 's'} planned for the full pricing release
                    </Text>
                  ) : null}
                </SurfaceCard>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <ActionButton label="Back" onPress={onClose} />
                <ActionButton label="Save Flip" onPress={saveAnalyzed} primary />
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
