import React from 'react';
import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://synapticai25.vercel.app';

interface SeoProps {
  title: string;
  description: string;
  path: string; // e.g. "/recruiter/login"
  ogType?: 'website' | 'article';
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const Seo: React.FC<SeoProps> = ({ title, description, path, ogType = 'website', jsonLd }) => {
  const url = `${SITE_URL}${path}`;
  const safeTitle = title.length > 60 ? title.slice(0, 57) + '…' : title;
  const safeDesc = description.length > 160 ? description.slice(0, 157) + '…' : description;
  return (
    <Helmet>
      <title>{safeTitle}</title>
      <meta name="description" content={safeDesc} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={safeTitle} />
      <meta property="og:description" content={safeDesc} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta name="twitter:title" content={safeTitle} />
      <meta name="twitter:description" content={safeDesc} />
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default Seo;
