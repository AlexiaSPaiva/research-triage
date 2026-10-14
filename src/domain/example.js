/**
 * A worked example for first-time visitors: one research profile and a handful
 * of short, invented abstracts (not real papers) chosen so the ranking shows its
 * range — strong matches, partial ones, and a relevant paper written in other
 * words that scores low, which is exactly the limitation the app warns about.
 */
import { createProfile } from '../shared/researchProfile.js';

export function exampleProfile() {
  return createProfile(
    'Differentiating dementia etiologies (Alzheimer, vascular, frontotemporal and Lewy body) from longitudinal patterns of cognitive decline, behavioural symptoms and clinical history in an ageing cohort.',
    [
      'Identify which cognitive domains decline first in each etiology',
      'Compare predictive models trained on longitudinal cohort data',
    ],
  );
}

const ARTICLES = [
  {
    title:
      'Longitudinal cognitive trajectories distinguish Alzheimer and vascular dementia in older adults',
    abstract:
      'Using six waves of an ageing cohort, we modelled the decline of memory, executive function and processing speed. Alzheimer dementia showed early episodic memory decline, while vascular dementia showed earlier executive and speed decline. Trajectory features improved etiology classification over single-visit scores.',
    year: 2023,
  },
  {
    title: 'Behavioural symptoms as early markers of frontotemporal dementia',
    abstract:
      'Apathy, disinhibition and loss of empathy preceded measurable cognitive decline by several years in patients later diagnosed with frontotemporal dementia. We discuss how behavioural symptoms can help separate frontotemporal from Alzheimer dementia in longitudinal clinical records.',
    year: 2022,
  },
  {
    title: 'Predictive models for dementia subtype classification: a comparison on cohort data',
    abstract:
      'We compared logistic regression, random forests and gradient boosting for classifying dementia etiology from cohort variables including cognitive tests, depressive symptoms and clinical history. Ensemble models performed best, but calibration and external validation remained limited.',
    year: 2024,
  },
  {
    title: 'Visual hallucinations and fluctuating attention in Lewy body disease',
    abstract:
      'Recurrent visual hallucinations, fluctuating attention and REM sleep behaviour disorder were the features most associated with Lewy body disease in a memory-clinic sample, and appeared before marked memory impairment.',
    year: 2021,
  },
  {
    title: 'Social isolation and loneliness in later life: a cross-sectional survey',
    abstract:
      'We surveyed 2,000 adults aged 65 and over about social contact, loneliness and wellbeing. Loneliness was associated with poorer self-rated health and lower physical activity.',
    year: 2020,
  },
  {
    title: 'How memory clinics tell apart the main causes of progressive forgetfulness',
    abstract:
      'A narrative review of how clinicians separate the commonest causes of progressive forgetfulness in old age: the order in which abilities fade, changes in personality and conduct, and the medical background each person brings.',
    year: 2019,
  },
];

/** The example articles, in the shape the rest of the app expects. */
export function exampleArticles() {
  return ARTICLES.map((article, index) => ({
    id: `example-${index + 1}`,
    title: article.title,
    abstract: article.abstract,
    authors: ['Example data (invented)'],
    year: article.year,
    doi: '',
  }));
}
