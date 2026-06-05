import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadField, saveField } from '../utils/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { useTheme } from '../context/ThemeContext';
import { Swipeable } from 'react-native-gesture-handler';

const darken = (hex: string, f = 0.75) => {
  const r = Math.round(parseInt(hex.slice(1,3),16) * f);
  const g = Math.round(parseInt(hex.slice(3,5),16) * f);
  const b = Math.round(parseInt(hex.slice(5,7),16) * f);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
};

interface Criterion {
  id: number;
  name: string;
  percentage: number;
  grade: string;
}

interface Grade {
  id: number;
  name: string;
  credits: number;
  value: number;
  semester: string;
  year: string;
  criteria: Criterion[];
  date: string;
}

const SEMESTERS = ['א', 'ב', 'קיץ'];
const YEARS     = ['שנה א', 'שנה ב', 'שנה ג', 'שנה ד'];

const genId = () => Date.now() * 10000 + Math.floor(Math.random() * 10000);

// Accept both "30" and "0.3" as 30%
const normalizePct = (val: string): number => {
  const n = Number(val);
  if (isNaN(n) || n <= 0) return 0;
  return n > 0 && n <= 1 ? Math.round(n * 100) : Math.round(n);
};

const GradesScreen = ({ onClose }: { onClose?: () => void }) => {
  const themeObj = useTheme();
  const theme    = themeObj.accent;
  const bg       = themeObj.bg;
  const surface  = themeObj.surface;
  const tabBg    = themeObj.tabBg;
  const textColor = themeObj.text;
  const textSub  = themeObj.textSub;
  const borderClr  = themeObj.border;
  const isDark     = themeObj.mode === 'dark';
  const darkShadow: object = isDark
    ? (Platform.select({ web: { boxShadow: `0 4px 20px ${theme}30, 0 1px 6px rgba(0,0,0,0.5)` } as any, default: { shadowColor: theme, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 6 } }) ?? {})
    : {};
  const light      = theme + '22';
  const { showAlert, showConfirm, showDestructiveConfirm, alertNode } = useCustomAlert(theme);

  const [grades, setGrades]         = useState<Grade[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading]   = useState(true);
  const [saving, setSaving]         = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null);

  // ── Simulation state ──────────────────────────────────────────────────────
  const [simMode,    setSimMode]    = useState(false);
  const [simCourses, setSimCourses] = useState<{id:number;name:string;credits:number;grade:number;included:boolean}[]>([]);
  const [simModalVisible, setSimModalVisible] = useState(false);
  const [simName,    setSimName]    = useState('');
  const [simCredits, setSimCredits] = useState('');
  const [simGrade,   setSimGrade]   = useState('');

  // Form fields
  const [courseName, setCourseName] = useState('');
  const [credits, setCredits]       = useState('');
  const [semester, setSemester]     = useState('א');
  const [year, setYear]             = useState('שנה א');
  const [criteria, setCriteria]     = useState<Criterion[]>([]);

  // Criterion form
  const [critName,       setCritName]       = useState('');
  const [critPct,        setCritPct]        = useState('');
  const [critGrade,      setCritGrade]      = useState('');
  const [showCritForm,   setShowCritForm]   = useState(false);

  useFocusEffect(useCallback(() => { loadGrades(); }, []));

  const loadGrades = async () => {
    try {
      const data = await loadField('grades');
      if (data) setGrades(data);
    } catch (e) { console.log(e); } finally { setIsLoading(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGrades();
    setRefreshing(false);
  };

  // Weighted average: Σ(grade × credits) / Σ(credits).
  // A course is "graded" when value > 0 OR when criteria exist (value 0 is a
  // legitimate failing grade). value === 0 with no criteria means "not yet graded".
  const calcWeightedAvg = (list: Grade[]) => {
    const withGrades = list.filter(
      (g) => g.credits > 0 && (g.value > 0 || g.criteria.some(c => c.percentage > 0))
    );
    if (withGrades.length === 0) return '-';
    const sumWeighted = withGrades.reduce((s, g) => s + g.value * g.credits, 0);
    const sumCredits  = withGrades.reduce((s, g) => s + g.credits, 0);
    return (sumWeighted / sumCredits).toFixed(2);
  };

  const totalCredits = grades.reduce((s, g) => s + (g.credits || 0), 0);

  // ── Simulation computed ───────────────────────────────────────────────────
  const simAsGrades: Grade[] = simCourses
    .filter(c => c.included)
    .map((c, i) => ({
      id: -(i + 1), name: c.name, credits: c.credits, value: c.grade,
      semester: 'א', year: 'שנה א', criteria: [], date: '',
    }));
  const simAvg = simCourses.length > 0
    ? calcWeightedAvg([...grades, ...simAsGrades])
    : null;

  const addSimCourse = () => {
    const name    = simName.trim();
    const credits = parseFloat(simCredits);
    const grade   = parseFloat(simGrade);
    if (!name)              return showAlert('שגיאה', 'הזיני שם קורס');
    if (!credits || credits <= 0) return showAlert('שגיאה', 'הזיני נקודות זכות תקינות');
    if (!grade || grade < 0 || grade > 100) return showAlert('שגיאה', 'הזיני ציון בין 0 ל-100');
    setSimCourses(prev => [...prev, { id: genId(), name, credits, grade, included: true }]);
    setSimName(''); setSimCredits(''); setSimGrade('');
    setSimModalVisible(false);
  };

  const pctUsed = criteria.reduce((s, c) => s + c.percentage, 0);

  // Returns computed grade only when all criteria are filled AND sum == 100
  const calcAutoGrade = () => {
    if (criteria.length === 0) return null;
    const allFilled = criteria.every((c) => c.grade !== '' && !isNaN(Number(c.grade)));
    if (!allFilled) return null;
    if (pctUsed !== 100) return null;
    const weighted = criteria.reduce((s, c) => s + Number(c.grade) * c.percentage / 100, 0);
    return String(Math.round(weighted));
  };

  const autoGrade = calcAutoGrade();

  // ── Criterion CRUD ────────────────────────────────────────────────────────
  const handleAddCriterion = () => {
    if (!critName.trim()) return showAlert('שגיאה', 'הזן שם לקריטריון');
    const pct = normalizePct(critPct);
    if (pct <= 0) return showAlert('שגיאה', 'הזן אחוז תקין\n(למשל: 30 או 0.3)');
    if (pct > 100) return showAlert('שגיאה', 'אחוז לא יכול לעלות על 100');
    if (pctUsed + pct > 100)
      return showAlert('שגיאה', `נותרו רק ${100 - pctUsed}% לחלוקה`);

    setCriteria([...criteria, { id: genId(), name: critName.trim(), percentage: pct, grade: critGrade }]);
    setCritName(''); setCritPct(''); setCritGrade('');
    setShowCritForm(false);
  };

  const removeCriterion = (id: number) =>
    setCriteria(criteria.filter((c) => c.id !== id));

  const updateCritGrade = (id: number, val: string) =>
    setCriteria(criteria.map((c) => c.id === id ? { ...c, grade: val } : c));

  // ── Form reset / open edit ────────────────────────────────────────────────
  const resetForm = () => {
    setCourseName(''); setCredits(''); setSemester('א'); setYear('שנה א');
    setCriteria([]); setCritName(''); setCritPct(''); setCritGrade('');
    setShowCritForm(false); setEditingId(null);
  };

  const openEdit = (item: Grade) => {
    setCourseName(item.name);
    setCredits(String(item.credits));
    setSemester(item.semester);
    setYear(item.year);
    setCriteria(item.criteria ?? []);
    setCritName(''); setCritPct(''); setCritGrade('');
    setShowCritForm(false);
    setEditingId(item.id);
    setModalVisible(true);
  };

  // ── Save (add or edit) ────────────────────────────────────────────────────
  const doSave = async (gradeValue: number) => {
    const gradeObj: Grade = {
      id: editingId ?? genId(),
      name: courseName.trim(),
      credits: Number(credits),
      value: gradeValue,
      semester,
      year,
      criteria,
      date: new Date().toLocaleDateString('he-IL'),
    };
    const updated = editingId !== null
      ? grades.map((g) => g.id === editingId ? gradeObj : g)
      : [...grades, gradeObj];

    setGrades(updated);
    setSaving(true);
    try {
      await saveField('grades', updated);
      resetForm();
      setModalVisible(false);
    } catch { showAlert('שגיאה', 'שמירת הציון נכשלה. בדקי את החיבור לאינטרנט ונסי שוב.'); }
    finally { setSaving(false); }
  };

  const handleSaveGrade = async () => {
    if (!courseName.trim()) return showAlert('שגיאה', 'אנא הזן שם קורס');
    const cred = Number(credits);
    if (credits === '' || isNaN(cred) || cred < 0)
      return showAlert('שגיאה', 'אנא הזן מספר נקודות זכות תקין');
    if (criteria.length === 0)
      return showAlert('שגיאה', 'אנא הוסף לפחות קריטריון אחד\n(ניתן להוסיף קריטריון אחד עם 100%)');

    if (pctUsed < 100) {
      showConfirm(
        'שים לב',
        `סך האחוזים הוא ${pctUsed}% בלבד.\nהציון הסופי לא יחושב עד שסך האחוזים יגיע ל-100%.\nהאם להמשיך?`,
        () => doSave(0),
      );
      return;
    }

    // pctUsed === 100
    await doSave(autoGrade ? Number(autoGrade) : 0);
  };

  const handleDeleteGrade = (id: number) => {
    Vibration.vibrate(40);
    showDestructiveConfirm('מחק ציון', 'האם אתה בטוח שברצונך למחוק את הציון?', 'מחק', async () => {
      const updated = grades.filter((g) => g.id !== id);
      setGrades(updated);
      await saveField('grades', updated);
    });
  };

  // ── Grade list item ───────────────────────────────────────────────────────
  const GradeItem = ({ item }: { item: Grade }) => {
    const itemCriteria = item.criteria ?? [];
    const card = (
      <View style={[styles.gradeItem, { borderRightColor: theme, backgroundColor: surface, borderWidth: 1, borderColor: borderClr }, darkShadow as any]}>
        <View style={styles.gradeInfo}>
          <Text style={[styles.gradeName, { color: textColor }]}>{item.name}</Text>
          <Text style={[styles.gradeMeta, { color: textSub }]}>
            {[item.year, item.semester ? `סמסטר ${item.semester}` : null, item.credits ? `${item.credits} נ"ז` : null]
              .filter(Boolean).join(' · ')}
          </Text>
          {itemCriteria.length > 0 && (
            <View style={styles.criteriaRow}>
              {itemCriteria.map((c) => (
                <Text key={c.id} style={[styles.criterionTag, { color: theme, backgroundColor: light }]}>{c.name} {c.percentage}%</Text>
              ))}
            </View>
          )}
        </View>
        <View style={styles.gradeRight}>
          <Text style={[styles.gradeValue, { color: theme }, item.value === 0 && styles.gradeValuePending]}>
            {item.value > 0 ? item.value : '—'}
          </Text>
          <View style={styles.gradeActions}>
            <TouchableOpacity accessibilityLabel={`ערוך ${item.name}`} accessibilityRole="button" onPress={() => openEdit(item)} style={styles.actionBtn}>
              <MaterialCommunityIcons name="pencil-outline" size={17} color={theme} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityLabel={`מחק ${item.name}`} accessibilityRole="button" onPress={() => handleDeleteGrade(item.id)} style={styles.actionBtn}>
              <MaterialCommunityIcons name="trash-can-outline" size={17} color="#ff6b6b" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
    if (Platform.OS === 'web') return card;
    return (
      <Swipeable
        overshootRight={false}
        renderRightActions={() => (
          <TouchableOpacity style={styles.swipeDeleteBtn} onPress={() => handleDeleteGrade(item.id)}>
            <MaterialCommunityIcons name="trash-can-outline" size={22} color="#fff" />
            <Text style={styles.swipeDeleteText}>מחק</Text>
          </TouchableOpacity>
        )}
      >
        {card}
      </Swipeable>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {onClose && (
        <View style={[styles.topBar, { backgroundColor: bg, borderBottomColor: borderClr }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <MaterialCommunityIcons name="chevron-right" size={26} color={theme} />
            <Text style={[styles.backText, { color: theme }]}>חזרה</Text>
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: textColor }]}>ציונים</Text>
          <View style={{ width: 80 }} />
        </View>
      )}
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme} />}
      >
        {/* Average Card */}
        <LinearGradient colors={[theme, darken(theme)]} style={styles.avgCard}>
          <View style={styles.avgRow}>
            <View>
              <Text style={styles.avgLabel}>ממוצע משוקלל</Text>
              <Text style={styles.avgValue}>{calcWeightedAvg(grades)}</Text>
            </View>
            <View style={styles.avgDivider} />
            <View>
              <Text style={styles.avgLabel}>סה"כ נ"ז</Text>
              <Text style={styles.avgValue}>{totalCredits}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Simulation button ────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.simToggleBtn, { borderColor: theme, backgroundColor: 'transparent', display: simMode ? 'none' : 'flex' }]}
          onPress={() => setSimMode(true)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="calculator-variant-outline" size={18} color={theme} />
          <Text style={[styles.simToggleText, { color: theme }]}>
            סימולציה — חשב ממוצע עתידי
          </Text>
        </TouchableOpacity>

        {/* ── Simulation panel ─────────────────────────────────────────── */}
        {simMode && (
          <View style={[styles.simPanel, { backgroundColor: surface, borderColor: theme + '55' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity
                onPress={() => { setSimMode(false); setSimCourses([]); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={20} color={textSub} />
              </TouchableOpacity>
              <Text style={[styles.simPanelTitle, { color: textColor }]}>סימולציה</Text>
            </View>
            <Text style={[styles.simPanelSub, { color: textSub }]}>
              הוסיפי קורסים היפותטיים וראי איך הממוצע ישתנה
            </Text>

            {/* Simulated avg result */}
            {simAvg && simAvg !== '-' && (() => {
              const currentAvg = calcWeightedAvg(grades);
              const delta = currentAvg !== '-'
                ? parseFloat(simAvg) - parseFloat(currentAvg)
                : null;
              return (
                <View style={[styles.simResult, { backgroundColor: theme + '22', borderColor: theme + '55' }]}>
                  <Text style={[styles.simResultLabel, { color: textSub }]}>ממוצע צפוי</Text>
                  <Text style={[styles.simResultValue, { color: theme }]}>{simAvg}</Text>
                  {delta !== null && (
                    <Text style={[styles.simResultLabel, { color: textSub }]}>
                      {delta >= 0
                        ? `▲ עלייה מ-${currentAvg}`
                        : `▼ ירידה מ-${currentAvg}`}
                    </Text>
                  )}
                </View>
              );
            })()}

            {/* Sim courses list */}
            {simCourses.map(c => (
              <View key={c.id} style={[styles.simCourseRow, { borderBottomColor: borderClr, opacity: c.included ? 1 : 0.45 }]}>
                <View style={styles.simCourseActions}>
                  <TouchableOpacity
                    onPress={() => setSimCourses(prev => prev.map(x => x.id === c.id ? { ...x, included: true } : x))}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <MaterialCommunityIcons
                      name="plus-circle-outline"
                      size={18}
                      color={c.included ? theme : textSub}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSimCourses(prev => prev.map(x => x.id === c.id ? { ...x, included: false } : x))}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <MaterialCommunityIcons
                      name="close-circle-outline"
                      size={18}
                      color={c.included ? '#ff6b6b' : textSub}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.simCourseName, { color: textColor }]} numberOfLines={1}>{c.name}</Text>
                <Text style={[styles.simCourseDetail, { color: textSub }]}>{c.credits} נ"ז</Text>
                <Text style={[styles.simCourseGrade, { color: theme }]}>{c.grade}</Text>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.simAddBtn, { borderColor: theme, backgroundColor: theme + '15' }]}
              onPress={() => setSimModalVisible(true)}
            >
              <MaterialCommunityIcons name="plus" size={18} color={theme} />
              <Text style={[styles.simAddBtnText, { color: theme }]}>הוסף קורס לסימולציה</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={theme} />
          </View>
        ) : grades.length > 0 ? (
          YEARS.map((yr) => {
            const semOrder: Record<string, number> = { 'א': 0, 'ב': 1, 'קיץ': 2 };
            const yearGrades = grades
              .filter((g) => g.year === yr)
              .sort((a, b) => (semOrder[a.semester] ?? 9) - (semOrder[b.semester] ?? 9));
            if (yearGrades.length === 0) return null;
            const yearAvg     = calcWeightedAvg(yearGrades);
            const yearCredits = yearGrades.reduce((s, g) => s + (g.credits || 0), 0);
            return (
              <View key={yr} style={styles.yearSection}>
                <View style={styles.yearHeader}>
                  <Text style={[styles.yearTitle, { color: textColor }]}>{yr}</Text>
                  <View style={styles.yearStats}>
                    <Text style={[styles.yearStat, { color: textSub }]}>{yearCredits} נ"ז</Text>
                    <View style={[styles.yearAvgBadge, { backgroundColor: theme }]}>
                      <Text style={styles.yearAvgText}>ממוצע {yearAvg}</Text>
                    </View>
                  </View>
                </View>
                {yearGrades.map((item, idx) => (
                  <View key={item.id}>
                    <GradeItem item={item} />
                    {idx < yearGrades.length - 1 && <View style={{ height: 8 }} />}
                  </View>
                ))}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="school-outline" size={64} color={textSub} />
            <Text style={[styles.emptyStateText, { color: textColor }]}>אין ציונים עדיין</Text>
            <Text style={[styles.emptyStateSub, { color: textSub }]}>הוסיפי קורס עם כפתור + למטה</Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity accessibilityLabel="הוסף ציון חדש" accessibilityRole="button" style={[styles.fab, { backgroundColor: theme, shadowColor: theme }]} onPress={() => { resetForm(); setModalVisible(true); }}>
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add / Edit Grade Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: tabBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>{editingId !== null ? 'עריכת ציון' : 'הוסף ציון חדש'}</Text>
              <TouchableOpacity onPress={() => { resetForm(); setModalVisible(false); }}>
                <MaterialCommunityIcons name="close" size={24} color={textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <Text style={[styles.label, { color: textSub }]}>שם הקורס</Text>
              <TextInput style={[styles.input, { backgroundColor: surface, borderColor: borderClr, color: textColor }]} placeholder="למשל: חדו״א 1" placeholderTextColor={textSub}
                value={courseName} onChangeText={setCourseName} />

              <Text style={[styles.label, { color: textSub }]}>נקודות זכות</Text>
              <TextInput style={[styles.input, { backgroundColor: surface, borderColor: borderClr, color: textColor }]} placeholder="למשל: 3" placeholderTextColor={textSub}
                value={credits} onChangeText={setCredits} keyboardType="decimal-pad" />

              <Text style={[styles.label, { color: textSub }]}>סמסטר</Text>
              <View style={styles.chipRow}>
                {SEMESTERS.map((s) => (
                  <Pressable key={s} style={[styles.chip, { borderColor: borderClr, backgroundColor: surface }, semester === s && { borderColor: theme, backgroundColor: light }]} onPress={() => setSemester(s)}>
                    <Text style={[styles.chipText, { color: textSub }, semester === s && { color: theme }]}>סמסטר {s}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.label, { color: textSub }]}>שנה</Text>
              <View style={styles.chipRow}>
                {YEARS.map((y) => (
                  <Pressable key={y} style={[styles.chip, { borderColor: borderClr, backgroundColor: surface }, year === y && { borderColor: theme, backgroundColor: light }]} onPress={() => setYear(y)}>
                    <Text style={[styles.chipText, { color: textSub }, year === y && { color: theme }]}>{y}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Criteria */}
              <View style={styles.criteriaSection}>
                <View style={styles.criteriaHeader}>
                  <Text style={[styles.label, { color: textSub }]}>קריטריונים לציון</Text>
                  <Text style={[styles.pctBadge, { color: theme, backgroundColor: light }, pctUsed === 100 && styles.pctBadgeFull]}>{pctUsed}/100%</Text>
                </View>

                {criteria.map((c) => (
                  <View key={c.id} style={[styles.criterionRow, { backgroundColor: surface }]}>
                    <View style={styles.criterionInfo}>
                      <Text style={[styles.criterionName, { color: textColor }]}>{c.name}</Text>
                      <Text style={[styles.criterionPct, { color: textSub }]}>{c.percentage}%</Text>
                    </View>
                    <TextInput
                      style={[styles.criterionGradeInput, { borderColor: borderClr, backgroundColor: tabBg, color: textColor }]}
                      placeholder="ציון"
                      placeholderTextColor={textSub}
                      value={c.grade}
                      onChangeText={(v) => updateCritGrade(c.id, v)}
                      keyboardType="decimal-pad"
                    />
                    <Pressable accessibilityLabel={`הסר קריטריון ${c.name}`} accessibilityRole="button" onPress={() => removeCriterion(c.id)} style={{ padding: 6 }}>
                      <MaterialCommunityIcons name="close-circle" size={18} color="#ccc" />
                    </Pressable>
                  </View>
                ))}

                {showCritForm ? (
                  <View style={[styles.critFormBox, { backgroundColor: surface }]}>
                    <TextInput style={[styles.critInput, { borderColor: borderClr, backgroundColor: tabBg, color: textColor }]} placeholder="שם (למשל: בחינה סופית)" placeholderTextColor={textSub}
                      value={critName} onChangeText={setCritName} />
                    <View style={styles.critRow}>
                      <TextInput
                        style={[styles.critInput, { flex: 1, borderColor: borderClr, backgroundColor: tabBg, color: textColor }]}
                        placeholder="משקל: 30 או 0.3" placeholderTextColor={textSub}
                        value={critPct}
                        onChangeText={setCritPct}
                        keyboardType="decimal-pad"
                      />
                      <TextInput style={[styles.critInput, { flex: 1, borderColor: borderClr, backgroundColor: tabBg, color: textColor }]} placeholder="ציון (אופציונלי)" placeholderTextColor={textSub}
                        value={critGrade} onChangeText={setCritGrade} keyboardType="decimal-pad" />
                    </View>
                    <View style={styles.critButtons}>
                      <Pressable style={styles.critCancelBtn} onPress={() => setShowCritForm(false)}>
                        <Text style={styles.critCancelText}>ביטול</Text>
                      </Pressable>
                      <Pressable style={[styles.critAddBtn, { backgroundColor: theme }]} onPress={handleAddCriterion}>
                        <Text style={styles.critAddText}>הוסף</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : pctUsed < 100 ? (
                  <Pressable style={[styles.addCritBtn, { borderColor: theme }]} onPress={() => setShowCritForm(true)}>
                    <MaterialCommunityIcons name="plus" size={16} color={theme} />
                    <Text style={[styles.addCritText, { color: theme }]}>הוסף קריטריון</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Computed grade preview */}
              {autoGrade && (
                <View style={[styles.autoGradeBox, { backgroundColor: light }]}>
                  <Text style={[styles.autoGradeLabel, { color: theme }]}>ציון סופי מחושב</Text>
                  <Text style={[styles.autoGradeValue, { color: theme }]}>{autoGrade}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme, opacity: saving ? 0.6 : 1 }]}
                onPress={handleSaveGrade}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.submitBtnText}>{editingId !== null ? 'שמור שינויים' : 'הוסף ציון'}</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Simulation Modal */}
      <Modal visible={simModalVisible} animationType="slide" transparent onRequestClose={() => setSimModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: tabBg }]}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setSimModalVisible(false)}>
                  <MaterialCommunityIcons name="close" size={24} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: textColor }]}>קורס סימולציה</Text>
                <View style={{ width: 24 }} />
              </View>

              <Text style={[styles.label, { color: textSub }]}>שם הקורס</Text>
              <TextInput
                style={[styles.input, { borderColor: borderClr, backgroundColor: surface, color: textColor }]}
                placeholder="לדוגמה: חדו״א 2"
                placeholderTextColor={textSub}
                value={simName}
                onChangeText={setSimName}
                textAlign="right"
              />

              <Text style={[styles.label, { color: textSub }]}>נקודות זכות</Text>
              <TextInput
                style={[styles.input, { borderColor: borderClr, backgroundColor: surface, color: textColor }]}
                placeholder="לדוגמה: 4"
                placeholderTextColor={textSub}
                value={simCredits}
                onChangeText={setSimCredits}
                keyboardType="decimal-pad"
                textAlign="right"
              />

              <Text style={[styles.label, { color: textSub }]}>ציון</Text>
              <TextInput
                style={[styles.input, { borderColor: borderClr, backgroundColor: surface, color: textColor }]}
                placeholder="0 – 100"
                placeholderTextColor={textSub}
                value={simGrade}
                onChangeText={setSimGrade}
                keyboardType="decimal-pad"
                textAlign="right"
              />

              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme }]} onPress={addSimCourse}>
                <Text style={styles.submitBtnText}>הוסף לסימולציה</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {alertNode}
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1 },
  topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 80 },
  backText:    { fontSize: 14, fontWeight: '600' },
  topBarTitle: { fontSize: 16, fontWeight: '700' },
  scrollView:  { flex: 1, padding: 15 },
  avgCard:     { borderRadius: 20, padding: 20, marginBottom: 20 },
  avgRow:      { flexDirection: 'row', alignItems: 'center', gap: 24 },
  avgDivider:  { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.3)' },
  avgLabel:    { color: '#fff', fontSize: 12, fontWeight: '600', opacity: 0.85 },
  avgValue:    { color: '#fff', fontSize: 32, fontWeight: '700', marginTop: 4 },
  yearSection:  { marginBottom: 24 },
  yearHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  yearTitle:    { fontSize: 16, fontWeight: '700', color: '#333' },
  yearStats:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  yearStat:     { fontSize: 12, color: '#999', fontWeight: '600' },
  yearAvgBadge: { backgroundColor: '#CE6385', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  yearAvgText:  { fontSize: 12, color: '#fff', fontWeight: '700' },
  gradeItem: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRightWidth: 4, borderRightColor: '#4CAFAE',
    shadowColor: '#3D1568', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.11, shadowRadius: 20, elevation: 6,
    ...Platform.select({ web: { boxShadow: '6px 6px 20px rgba(61,21,104,0.11), -3px -3px 12px rgba(255,255,255,0.90)' } as any, default: {} }),
  },
  gradeInfo:         { flex: 1, marginLeft: 8 },
  gradeName:         { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 3, textAlign: 'right' },
  gradeMeta:         { fontSize: 11, color: '#999', marginBottom: 5, textAlign: 'right' },
  criteriaRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  criterionTag:      { fontSize: 10, color: '#CE6385', backgroundColor: '#FFF0F5', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  gradeRight:        { alignItems: 'flex-end' },
  gradeValue:        { fontSize: 26, fontWeight: '700', color: '#CE6385', marginBottom: 4 },
  gradeValuePending: { fontSize: 20, color: '#ccc' },
  gradeActions:      { flexDirection: 'row', gap: 2 },
  actionBtn:         { padding: 5 },
  emptyState:        { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateText:    { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyStateSub:     { fontSize: 13, marginTop: 6, opacity: 0.7 },
  swipeDeleteBtn:    { backgroundColor: '#ff4757', justifyContent: 'center', alignItems: 'center', width: 72, borderRadius: 10, marginLeft: 8 },
  swipeDeleteText:   { color: '#fff', fontSize: 11, marginTop: 3 },
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#CE6385', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#CE6385', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent:   { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, maxHeight: '92%' },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:     { fontSize: 18, fontWeight: '700', color: '#333' },
  label:          { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' },
  input: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    backgroundColor: '#f9f9f9', marginBottom: 18, color: '#333', textAlign: 'right',
  },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip:           { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: '#e0e0e0', backgroundColor: '#f9f9f9' },
  chipActive:     { borderColor: '#CE6385', backgroundColor: '#FFF0F5' },
  chipText:       { fontSize: 13, color: '#999', fontWeight: '600' },
  chipTextActive: { color: '#CE6385' },
  criteriaSection: { marginBottom: 18 },
  criteriaHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pctBadge:        { fontSize: 12, fontWeight: '700', color: '#CE6385', backgroundColor: '#FFF0F5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  pctBadgeFull:    { color: '#fff', backgroundColor: '#51cf66' },
  criterionRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 10, padding: 10, marginBottom: 6, gap: 8 },
  criterionInfo:   { flex: 1 },
  criterionName:   { fontSize: 13, fontWeight: '600', color: '#333' },
  criterionPct:    { fontSize: 11, color: '#999' },
  criterionGradeInput: { width: 60, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, textAlign: 'center', backgroundColor: '#fff' },
  addCritBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#CE6385' },
  addCritText:     { fontSize: 13, color: '#CE6385', fontWeight: '600' },
  critFormBox:     { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 14, marginTop: 4 },
  critInput:       { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, backgroundColor: '#fff', marginBottom: 10, color: '#333', textAlign: 'right' },
  critRow:         { flexDirection: 'row', gap: 8 },
  critButtons:     { flexDirection: 'row', gap: 8 },
  critCancelBtn:   { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center' },
  critCancelText:  { fontSize: 13, color: '#999', fontWeight: '600' },
  critAddBtn:      { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#CE6385', alignItems: 'center' },
  critAddText:     { fontSize: 13, color: '#fff', fontWeight: '700' },
  autoGradeBox:    { backgroundColor: '#FFF0F5', borderRadius: 10, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  autoGradeLabel:  { fontSize: 13, color: '#CE6385' },
  autoGradeValue:  { fontSize: 22, fontWeight: '700', color: '#CE6385' },
  submitBtn:       { backgroundColor: '#CE6385', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 4, marginBottom: 24 },
  submitBtnText:   { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Simulation
  simToggleBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 10, marginBottom: 14 },
  simToggleText:   { fontSize: 13, fontWeight: '700' },
  simPanel:        { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16, gap: 12 },
  simPanelTitle:   { fontSize: 15, fontWeight: '700', textAlign: 'right' },
  simPanelSub:     { fontSize: 12, textAlign: 'right' },
  simResult:       { borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center', gap: 4 },
  simResultLabel:  { fontSize: 11, fontWeight: '600' },
  simResultValue:  { fontSize: 36, fontWeight: '900' },
  simCourseRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
  simCourseActions:{ flexDirection: 'row', gap: 4 },
  simCourseName:   { flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  simCourseDetail: { fontSize: 11 },
  simCourseGrade:  { fontSize: 16, fontWeight: '800', minWidth: 36, textAlign: 'right' },
  simAddBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 10 },
  simAddBtnText:   { fontSize: 13, fontWeight: '700' },
});

export default GradesScreen;
