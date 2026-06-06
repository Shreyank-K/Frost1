import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Animated,
  PanResponder,
  Dimensions,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../utils/theme';

const { width, height } = Dimensions.get('window');

function badgeConfig(level, theme) {
  if (level === 'HIGH') return { bg: theme.profitSoft, color: theme.profit };
  if (level === 'MEDIUM') return { bg: theme.warningSoft, color: theme.warning };
  return { bg: theme.lossSoft, color: theme.loss };
}

function fallbackConfidenceScore(level) {
  if (level === 'HIGH') return 0.78;
  if (level === 'MEDIUM') return 0.56;
  return 0.28;
}

function confidenceDisplayConfig(level, theme) {
  if (level === 'HIGH') {
    return { color: theme.profit };
  }

  if (level === 'MEDIUM') {
    return { color: theme.warning };
  }

  return { color: theme.loss };
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function modalGlowColors(theme) {
  return theme.mode === 'dark'
    ? ['rgba(92,200,255,0.96)', 'rgba(92,200,255,0.34)', 'rgba(92,200,255,0.74)']
    : ['rgba(29,143,225,0.62)', 'rgba(29,143,225,0.22)', 'rgba(29,143,225,0.4)'];
}

function modalBodyColors(theme) {
  return theme.mode === 'dark'
    ? ['#000000', '#000000']
    : [theme.cardSurface || theme.surface, theme.cardSurface || theme.surface];
}

function ModalBox({ theme, style, contentStyle, radius = 20, children }) {
  return (
    <LinearGradient
      colors={modalGlowColors(theme)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          borderRadius: radius,
          padding: 1.1,
        },
        style,
      ]}
    >
      <View
        style={[
          {
            borderRadius: Math.max(0, radius - 1),
            backgroundColor: theme.mode === 'dark' ? '#000000' : theme.surface,
            borderWidth: 1,
            borderColor: theme.cardBorderSoft || theme.cardBorder,
            overflow: 'hidden',
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

function DetailMetric({ icon, label, value, color, backgroundColor, theme }) {
  return (
    <ModalBox
      theme={theme}
      style={{
        flex: 1,
        shadowColor: theme.accent,
        shadowOpacity: theme.mode === 'dark' ? 0.2 : 0.1,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 5,
      }}
      contentStyle={{
        minHeight: 114,
        padding: 16,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text
        style={{
          color: theme.muted,
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginTop: 14,
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          color,
          fontSize: 24,
          fontWeight: '900',
          marginTop: 8,
        }}
      >
        {value}
      </Text>
    </ModalBox>
  );
}

function ModalShell({ visible, onClose, eyebrow, title, theme, children, hideHeaderCopy = false }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          padding: 24,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.mode === 'dark' ? 'rgba(1,6,10,0.7)' : 'rgba(15,23,42,0.28)',
        }}
      >
        <Pressable onPress={onClose} style={StyleSheet.absoluteFillObject} />

        <View style={{ width: '100%', maxWidth: 420 }}>
          <LinearGradient colors={modalGlowColors(theme)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 30, padding: 1.15 }}>
            <LinearGradient colors={modalBodyColors(theme)} style={{ borderRadius: 29, padding: 22, overflow: 'hidden', position: 'relative' }}>
              {hideHeaderCopy ? (
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.mode === 'dark'
                      ? pressed ? '#090909' : '#000000'
                      : pressed ? theme.surface : theme.surfaceElevated,
                    borderWidth: 1,
                    borderColor: theme.accentBorder || theme.cardBorder,
                    zIndex: 2,
                  })}
                >
                  <Ionicons name="close" size={13} color={theme.subtext} />
                </Pressable>
              ) : (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 18,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 14 }}>
                    <Text
                      style={{
                        color: theme.accent,
                        fontSize: 11,
                        fontWeight: '800',
                        letterSpacing: 1.4,
                        textTransform: 'uppercase',
                        marginBottom: 8,
                      }}
                    >
                      {eyebrow}
                    </Text>
                    <Text style={{ color: theme.text, fontSize: 24, fontWeight: '900', lineHeight: 30 }}>{title}</Text>
                  </View>

                  <Pressable
                    onPress={onClose}
                    hitSlop={8}
                    style={({ pressed }) => ({
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: theme.mode === 'dark'
                        ? pressed ? '#090909' : '#000000'
                        : pressed ? theme.surface : theme.surfaceElevated,
                      borderWidth: 1,
                      borderColor: theme.accentBorder || theme.cardBorder,
                    })}
                  >
                    <Ionicons name="close" size={18} color={theme.subtext} />
                  </Pressable>
                </View>
              )}

              {children}
            </LinearGradient>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const SwipeCard = forwardRef(function SwipeCard({ item = {}, onPass = () => {}, onSave = () => {}, disabled = false, preview = false, programmaticSwipe = null }, ref) {
  const { theme } = useTheme();
  const pan = useRef(new Animated.ValueXY()).current;
  const swipeLockedRef = useRef(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [titleModalVisible, setTitleModalVisible] = useState(false);

  const openDetailsModal = () => setDetailsModalVisible(true);
  const closeDetailsModal = () => setDetailsModalVisible(false);
  const openTitleModal = () => setTitleModalVisible(true);
  const closeTitleModal = () => setTitleModalVisible(false);

  const mountAnim = useRef(new Animated.Value(preview ? 0.96 : 0.98)).current;
  useEffect(() => {
    Animated.spring(mountAnim, { toValue: 1, friction: 10, tension: 70, useNativeDriver: false }).start();
  }, [mountAnim]);

  useEffect(() => {
    setImageFailed(false);
  }, [item.id, item.image]);

  const CARD_WIDTH = Math.min(width * 0.95, 450);
  const CARD_HEIGHT = preview ? Math.min(height * 0.62, 620) : Math.min(height * 0.58, 560);
  const compactCard = CARD_HEIGHT < 520;
  const imageHeight = preview
    ? Math.max(182, Math.min(CARD_HEIGHT * 0.36, 206))
    : Math.max(186, Math.min(CARD_HEIGHT * 0.39, 214));

  const rotate = pan.x.interpolate({
    inputRange: [-180, 0, 180],
    outputRange: ['-7deg', '0deg', '7deg'],
  });

  const animateSwipe = useCallback((direction, offsetY = 0) => {
    if (disabled || swipeLockedRef.current) return false;

    swipeLockedRef.current = true;
    const swipedRight = direction === 'right';

    Animated.timing(pan, {
      toValue: { x: swipedRight ? width : -width, y: offsetY },
      duration: 180,
      useNativeDriver: false,
    }).start(() => {
      if (swipedRight) {
        onSave(item);
      } else {
        onPass(item);
      }
      swipeLockedRef.current = false;
      requestAnimationFrame(() => pan.setValue({ x: 0, y: 0 }));
    });

    return true;
  }, [disabled, item, onPass, onSave, pan]);

  useImperativeHandle(ref, () => ({
    swipeLeft: () => animateSwipe('left'),
    swipeRight: () => animateSwipe('right'),
  }), [animateSwipe]);

  useEffect(() => {
    if (preview || !programmaticSwipe?.token) return;
    if (programmaticSwipe.itemId !== item.id) return;

    animateSwipe(programmaticSwipe.direction);
  }, [animateSwipe, item.id, preview, programmaticSwipe]);

  const responder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => !disabled && Math.abs(gesture.dx) > 18,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        if (disabled) return;
        if (Math.abs(gesture.dx) > 120) {
          animateSwipe(gesture.dx > 0 ? 'right' : 'left', gesture.dy);
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            speed: 18,
            bounciness: 8,
            useNativeDriver: false,
          }).start();
        }
      },
    }),
    [animateSwipe, disabled, pan]
  );

  const confidenceLevel = String(item.confidence || 'LOW').toUpperCase();
  const badge = badgeConfig(confidenceLevel, theme);
  const cardTitle = item.title || 'Untitled flip';
  const category = item.category || 'General';
  const condition = item.condition || 'Condition unknown';
  const profit = Number(item.profit || 0);
  const roi = Number(item.roi || 0);
  const buyPrice = Number(item.buy || 0);
  const sellPrice = Number(item.sell || 0);
  const shipping = Number(item.shipping || 0);
  const feesTotal = Number(item.fees || 0) + shipping;
  const profitColor = profit >= 0 ? theme.profit : theme.loss;
  const profitSign = profit >= 0 ? '+' : '-';
  const roiSign = roi >= 0 ? '+' : '-';
  const numericConfidenceScore = Number(item.confidenceScore);
  const confidenceScore = Number.isFinite(numericConfidenceScore)
    ? Math.max(0, Math.min(1, numericConfidenceScore))
    : fallbackConfidenceScore(confidenceLevel);
  const confidencePercent = Math.round(confidenceScore * 100);
  const confidenceWidth = `${Math.max(8, Math.min(100, confidencePercent))}%`;
  const confidenceUi = confidenceDisplayConfig(confidenceLevel, theme);
  const photoBorderColors = theme.mode === 'dark'
    ? ['rgba(92,200,255,0.5)', 'rgba(255,255,255,0.08)']
    : ['rgba(29,143,225,0.34)', 'rgba(15,23,42,0.05)'];
  const profitPanelColors = profit >= 0
    ? theme.mode === 'dark'
      ? ['rgba(35,197,82,0.42)', 'rgba(92,200,255,0.14)']
      : ['rgba(22,163,74,0.18)', 'rgba(29,143,225,0.08)']
    : theme.mode === 'dark'
      ? ['rgba(255,107,107,0.38)', 'rgba(92,200,255,0.14)']
      : ['rgba(220,38,38,0.16)', 'rgba(29,143,225,0.08)'];

  return (
    <View style={{ flex: 1 }}>
      <Animated.View
        {...(!disabled ? responder.panHandlers : {})}
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          borderRadius: 30,
          alignSelf: 'center',
          backgroundColor: 'transparent',
          shadowColor: theme.accent,
          shadowOpacity: theme.mode === 'dark' ? 0.32 : 0.18,
          shadowRadius: 26,
          shadowOffset: { width: 0, height: 12 },
          elevation: 14,
          transform: [
            { scale: mountAnim },
            ...(!preview ? [...pan.getTranslateTransform(), { rotate }] : [{ translateY: -8 }, { scale: 0.96 }]),
          ],
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 30,
            overflow: 'hidden',
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: theme.accent,
          }}
        >


            <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
              <LinearGradient colors={photoBorderColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 1.2 }}>
                <View
                  style={{
                    height: imageHeight,
                    borderRadius: 23,
                    overflow: 'hidden',
                    backgroundColor: theme.backgroundLayer1,
                  }}
                >
                  {!imageFailed && item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                      onError={() => setImageFailed(true)}
                    />
                  ) : (
                    <View
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: theme.backgroundLayer1,
                      }}
                    >
                      <Ionicons name="image-outline" size={42} color={theme.subtext} />
                    </View>
                  )}

                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(0,0,0,0.04)', theme.mode === 'dark' ? 'rgba(4,12,20,0.78)' : 'rgba(15,23,42,0.58)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
                  />

                  <View
                    style={{
                      position: 'absolute',
                      top: 12,
                      left: 12,
                      right: 12,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: badge.bg,
                        borderWidth: 1,
                        borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                      }}
                    >
                      <Text style={{ color: badge.color, fontSize: 11, fontWeight: '900', letterSpacing: 0.7 }}>
                        {confidenceLevel}
                      </Text>
                    </View>

                    <Pressable
                      onPress={openDetailsModal}
                      hitSlop={8}
                      style={({ pressed }) => ({
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: theme.mode === 'dark'
                          ? pressed ? 'rgba(4,12,20,0.84)' : 'rgba(4,12,20,0.68)'
                          : pressed ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.9)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: theme.mode === 'dark' ? 'rgba(92,200,255,0.24)' : 'rgba(29,143,225,0.18)',
                      })}
                    >
                      <Ionicons name="information-circle-outline" size={20} color={theme.accent} />
                    </Pressable>
                  </View>

                  <View
                    style={{
                      position: 'absolute',
                      left: 14,
                      right: 14,
                      bottom: 12,
                      flexDirection: 'row',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900' }}>
                        {category}
                      </Text>
                      <Text numberOfLines={1} style={{ color: 'rgba(239,248,255,0.8)', fontSize: 11, fontWeight: '700', marginTop: 4 }}>
                        {condition}
                      </Text>
                    </View>

                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: theme.mode === 'dark' ? 'rgba(4,12,20,0.64)' : 'rgba(255,255,255,0.92)',
                        borderWidth: 1,
                        borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                      }}
                    >
                      <Text style={{ color: profitColor, fontSize: 12, fontWeight: '900' }}>
                        {roiSign}{Math.abs(roi).toFixed(1)}% ROI
                      </Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </View>

            <View
              style={{
                flex: 1,
                paddingHorizontal: 18,
                paddingBottom: preview ? 14 : 16,
                justifyContent: 'space-between',
              }}
            >
              <View style={{ gap: compactCard ? 10 : 14 }}>
                <View
                  style={{
                    minHeight: compactCard ? 62 : 68,
                    maxHeight: compactCard ? 62 : 68,
                    justifyContent: 'space-between',
                  }}
                >
                  <View>
                    <Text
                      style={{
                        color: theme.muted,
                        fontSize: 10,
                        fontWeight: '800',
                        letterSpacing: 1.4,
                        textTransform: 'uppercase',
                      }}
                    >
                      Listing
                    </Text>
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{
                        color: theme.text,
                        fontSize: compactCard ? 20 : 22,
                        fontWeight: '900',
                        lineHeight: compactCard ? 26 : 28,
                        marginTop: 6,
                      }}
                    >
                      {cardTitle}
                    </Text>
                  </View>

                  <Pressable
                    onPress={openTitleModal}
                    hitSlop={6}
                    style={({ pressed }) => ({
                      alignSelf: 'flex-start',
                      flexDirection: 'row',
                      alignItems: 'center',
                      opacity: pressed ? 0.82 : 1,
                    })}
                  >
                    <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '800', marginRight: 5 }}>View title</Text>
                    <Ionicons name="chevron-forward" size={13} color={theme.accent} />
                  </Pressable>
                </View>

                <LinearGradient colors={profitPanelColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 1.1 }}>
                  <View
                    style={{
                      borderRadius: 23,
                      backgroundColor: theme.mode === 'dark' ? 'rgba(8,18,26,0.9)' : '#FFFFFF',
                      paddingVertical: compactCard ? 15 : 18,
                      paddingHorizontal: 18,
                    }}
                  >
                    <Text
                      style={{
                        color: theme.subtext,
                        fontSize: 10,
                        fontWeight: '800',
                        letterSpacing: 1.4,
                        textTransform: 'uppercase',
                        textAlign: 'center',
                      }}
                    >
                      Projected profit
                    </Text>

                    <Text
                      style={{
                        color: profitColor,
                        fontSize: compactCard ? 40 : 46,
                        fontWeight: '900',
                        letterSpacing: -1,
                        textAlign: 'center',
                        marginTop: 8,
                        textShadowColor: `${profitColor}33`,
                        textShadowOffset: { width: 0, height: 0 },
                        textShadowRadius: 14,
                      }}
                    >
                      {profitSign}${Math.abs(profit).toFixed(2)}
                    </Text>

                    <View style={{ alignItems: 'center', marginTop: compactCard ? 10 : 12 }}>
                      <View
                        style={{
                          paddingHorizontal: 13,
                          paddingVertical: 8,
                          borderRadius: 999,
                          backgroundColor: profit >= 0 ? theme.profitSoft : theme.lossSoft,
                          borderWidth: 1,
                          borderColor: profit >= 0 ? theme.profit : theme.loss,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <Ionicons name={roi >= 0 ? 'trending-up' : 'trending-down'} size={14} color={profitColor} style={{ marginRight: 6 }} />
                        <Text style={{ color: profitColor, fontSize: compactCard ? 16 : 18, fontWeight: '900' }}>
                          {roiSign}{Math.abs(roi).toFixed(1)}% ROI
                        </Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>

                <View style={{ paddingHorizontal: 2 }}>
                  <View
                    style={{
                      paddingVertical: compactCard ? 2 : 4,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text
                        style={{
                          flex: 1,
                          color: confidenceUi.color,
                          fontSize: compactCard ? 12 : 13,
                          fontWeight: '900',
                          letterSpacing: 0.8,
                        }}
                      >
                        {confidenceLevel} DEAL CONFIDENCE
                      </Text>
                      <Text style={{ color: theme.text, fontSize: compactCard ? 13 : 14, fontWeight: '800' }}>
                        {confidencePercent}%
                      </Text>
                    </View>

                    <View
                      style={{
                        marginTop: 8,
                        height: compactCard ? 8 : 10,
                        borderRadius: 999,
                        backgroundColor: theme.mode === 'dark' ? 'rgba(4,12,20,0.64)' : 'rgba(15,23,42,0.08)',
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: theme.cardBorder,
                      }}
                    >
                      <View style={{ width: confidenceWidth, height: '100%', backgroundColor: confidenceUi.color, borderRadius: 999 }} />
                    </View>
                  </View>
                </View>
              </View>

            </View>
          </View>
        </Animated.View>

      <ModalShell visible={detailsModalVisible} onClose={closeDetailsModal} eyebrow="Pricing details" title="Deal breakdown" theme={theme}>

        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <DetailMetric
              icon="pricetag-outline"
              label="Buy price"
              value={money(buyPrice)}
              color={theme.loss}
              backgroundColor={theme.lossSoft}
              theme={theme}
            />
            <DetailMetric
              icon="cash-outline"
              label="Sell price"
              value={money(sellPrice)}
              color={theme.profit}
              backgroundColor={theme.profitSoft}
              theme={theme}
            />
          </View>

          <ModalBox
            theme={theme}
            contentStyle={{
              borderRadius: 20,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: theme.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="receipt-outline" size={16} color={theme.accent} />
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={{
                  color: theme.muted,
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                }}
              >
                Fees total
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                <Text
                  style={{
                    color: theme.accent,
                    fontSize: 22,
                    fontWeight: '900',
                    marginRight: 10,
                  }}
                >
                  {money(feesTotal)}
                </Text>

                <Text
                  style={{
                    color: theme.subtext,
                    fontSize: 12,
                    fontWeight: '800',
                    lineHeight: 18,
                  }}
                >
                  {shipping > 0 ? `Includes est. shipping ${money(shipping)}` : 'No shipping added'}
                </Text>
              </View>
            </View>
          </ModalBox>
        </View>
      </ModalShell>

      <ModalShell visible={titleModalVisible} onClose={closeTitleModal} eyebrow="Full title" title="Listing title" theme={theme} hideHeaderCopy>
        <Text
          style={{
            color: theme.muted,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1.1,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Full listing title
        </Text>
        <ModalBox theme={theme} radius={22} contentStyle={{ padding: 18 }}>
          <Text
            style={{
              color: theme.text,
              fontSize: 24,
              fontWeight: '700',
              lineHeight: 32,
            }}
          >
            {cardTitle}
          </Text>
        </ModalBox>

        <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10, marginTop: 14 }}>
          <ModalBox theme={theme} style={{ flex: 1, minHeight: 82 }} radius={18} contentStyle={{ padding: 14, minHeight: 80 }}>
            <Text style={{ color: theme.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Category
            </Text>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800', marginTop: 8 }}>{category}</Text>
          </ModalBox>

          <ModalBox theme={theme} style={{ flex: 1, minHeight: 82 }} radius={18} contentStyle={{ padding: 14, minHeight: 80 }}>
            <Text style={{ color: theme.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Condition
            </Text>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800', marginTop: 8 }}>{condition}</Text>
          </ModalBox>
        </View>
      </ModalShell>
    </View>
  );
});

export default SwipeCard;
