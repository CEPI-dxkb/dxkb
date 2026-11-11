import React from "react";
import styled from "styled-components";

import logo from "@auspice/images/logo-light.svg";

/** Replaces Auspice's stock nav bar, whose hardcoded `<a href="/">` would render DXKB's home inside the iframe; links go to the Auspice docs instead. */
const docsUrl = "https://docs.nextstrain.org/projects/auspice/";

const Container = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  height: 100%;
`;

const Title = styled.a`
  padding: 0px;
  text-decoration: none;
  color: ${(props) => props.theme.color};
  font-size: 20px;
  font-weight: 400;
  cursor: pointer;
  letter-spacing: 1rem;
`;

const LogoLink = styled.a`
  display: block;
  margin: 5px;
  width: 40px;
  height: 40px;
  background: center / contain no-repeat url(${logo});
  cursor: pointer;
`;

const Spacer = styled.div`
  flex: 1;
`;

function DxkbNavBar({ sidebar }) {
  if (!sidebar) return null;
  return (
    <Container>
      <Spacer />
      <LogoLink
        href={docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Auspice documentation"
      />
      <Spacer />
      <Title href={docsUrl} target="_blank" rel="noopener noreferrer">
        auspice
      </Title>
      <Spacer />
    </Container>
  );
}

export default DxkbNavBar;
