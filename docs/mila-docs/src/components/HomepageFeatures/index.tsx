import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Typescript-first',
    Svg: require('@site/static/img/undraw_code_review_blue.svg').default,
    description: (
      <>
        Write your business logic code and your unit tests using Typescript.
        Standard build, ESLint and Jest configurations included.
      </>
    ),
  },
  {
    title: 'Clever builds',
    Svg: require('@site/static/img/undraw_maker_launch.svg').default,
    description: (
      <>
        Let your project scale with compilation caching and distributed builds.
        In your pipelines, you can easily tests and deploy only affected micro-services.
      </>
    ),
  },
  {
    title: 'Be more productive',
    Svg: require('@site/static/img/undraw_dev_productivity.svg').default,
    description: (
      <>
        Enable your team to re-use code via properly versioned shared packages.
        Create your own blueprints for custom code generation and stop wasting time on boilerplate.
      </>
    ),
  },
  {
    title: 'Conquer the world',
    Svg: require('@site/static/img/undraw_the_world_is_mine.svg').default,
    description: (
      <>
        Infrastructure geo-replication and latency based routing has never been that simple.
        Serve your end-users worldwide with a low latency.
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row space-evenly">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
